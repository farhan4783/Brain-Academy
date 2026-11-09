import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
} from "@temporalio/workflow";
import type * as sandboxActivities from "../activities/sandbox.activities.js";
import type * as modelActivities from "../activities/model.activities.js";
import {
  AgentState,
  AgentStepIteration,
  TaskRequest,
} from "@hermes/shared";

const {
  provisionSandboxActivity,
  executeCommandActivity,
  captureGitDiffActivity,
  destroySandboxActivity,
  compensatingTransactionsActivity,
} = proxyActivities<typeof sandboxActivities>({
  startToCloseTimeout: "5 minutes",
  retry: {
    initialInterval: "2 seconds",
    maximumAttempts: 3,
  },
});

const {
  inferAgentStepActivity,
  checkAndPerformCompactionActivity,
  reflectAndSynthesizeSkillActivity,
} = proxyActivities<typeof modelActivities>({
  startToCloseTimeout: "3 minutes",
  retry: {
    initialInterval: "2 seconds",
    maximumAttempts: 3,
  },
});

// Signals & Queries for real-time interaction
export const cancelTaskSignal = defineSignal("cancelTask");
export const pauseTaskSignal = defineSignal("pauseTask");
export const resumeTaskSignal = defineSignal("resumeTask");
export const approveExecutionSignal = defineSignal<[boolean]>("approveExecution");
export const provideFeedbackSignal = defineSignal<[string]>("provideFeedback");
export const getAgentStateQuery = defineQuery<AgentState>("getAgentState");

export async function hermesAgentWorkflow(request: TaskRequest): Promise<AgentState> {
  let isCancelled = false;
  let isPaused = false;
  let approvalDecision: boolean | null = null;
  let userFeedback: string | null = null;

  const state: AgentState = {
    taskId: request.taskId,
    status: "INITIALIZING_SANDBOX",
    currentStep: 0,
    history: [],
    gitPatchAccumulator: [],
    totalTokensUsed: 0,
    totalCostUsd: 0,
    startTime: new Date().toISOString(),
  };

  setHandler(cancelTaskSignal, () => {
    isCancelled = true;
    state.status = "FAILED";
    state.errorMessage = "Cancelled by user";
  });

  setHandler(pauseTaskSignal, () => {
    isPaused = true;
    state.status = "AWAITING_USER_INPUT";
  });

  setHandler(resumeTaskSignal, () => {
    isPaused = false;
    state.status = "RUNNING";
  });

  setHandler(approveExecutionSignal, (approved: boolean) => {
    approvalDecision = approved;
  });

  setHandler(provideFeedbackSignal, (feedback: string) => {
    userFeedback = feedback;
  });

  setHandler(getAgentStateQuery, () => state);

  let sandboxId = "";

  try {
    // Step 1: Provision Isolated MicroVM Sandbox (<500ms)
    const sandboxRes = await provisionSandboxActivity(
      request.taskId,
      request.repoUrl,
      request.repoBranch
    );
    sandboxId = sandboxRes.sandboxId;
    state.sandboxId = sandboxId;
    state.status = "RUNNING";

    const maxSteps = request.maxIterations || 25;

    // Step 2: Durable ReAct Execution Loop
    while (state.currentStep < maxSteps && !isCancelled) {
      // Pause handling
      if (isPaused) {
        await condition(() => !isPaused || isCancelled);
        if (isCancelled) break;
      }

      state.currentStep++;

      // Check context budget & compact if > 75% capacity
      const rawGitDiff = await captureGitDiffActivity(sandboxId);
      const compaction = await checkAndPerformCompactionActivity({
        currentStep: state.currentStep,
        history: state.history,
        rawGitDiff,
        totalTokens: state.totalTokensUsed,
      });

      if (compaction) {
        state.compactedHistory = compaction;
      }

      // Model inference step (dynamically routed between Tier 1 and Tier 2)
      const promptToUse = userFeedback
        ? `${request.prompt}\n[User Feedback]: ${userFeedback}`
        : request.prompt;
      userFeedback = null;

      const stepInference = await inferAgentStepActivity({
        taskPrompt: promptToUse,
        stepNumber: state.currentStep,
        history: state.history,
        compactedHistory: state.compactedHistory,
        rawGitDiff,
        totalTokensUsed: state.totalTokensUsed,
        totalCostUsd: state.totalCostUsd,
      });

      state.totalTokensUsed += stepInference.stepTokens;
      state.totalCostUsd += stepInference.stepCost;

      const currentIteration: AgentStepIteration = {
        stepNumber: state.currentStep,
        thought: stepInference.thought,
        toolCall: stepInference.toolCall,
        selectedTier: stepInference.selectedTier,
        tokenCount: stepInference.stepTokens,
        timestamp: new Date().toISOString(),
      };

      if (stepInference.isComplete) {
        state.status = "COMPLETED";
        state.history.push(currentIteration);

        // Autonomous Self-Evolution Learning Loop: Synthesize L4 Skill
        await reflectAndSynthesizeSkillActivity({
          taskPrompt: request.prompt,
          history: state.history,
          success: true,
        }).catch(() => {});

        break;
      }

      // Check for sensitive operations requiring human-in-the-loop approval
      const cmd =
        (stepInference.toolCall?.input.command as string) ||
        (stepInference.toolCall?.input.path ? `cat ${stepInference.toolCall.input.path}` : "");

      const isSensitive =
        cmd.includes("git push") ||
        cmd.includes("rm ") ||
        cmd.includes("publish") ||
        cmd.includes("deploy");

      if (isSensitive) {
        state.status = "AWAITING_USER_INPUT";
        approvalDecision = null;
        // Wait up to 10 minutes for human approval signal
        const approved = await condition(() => approvalDecision !== null, "10 minutes");
        if (!approved || approvalDecision === false) {
          currentIteration.observation = {
            toolCallId: `blocked_${Date.now()}`,
            stdout: "",
            stderr: "Operation rejected by user or approval timed out.",
            exitCode: 1,
            durationMs: 0,
            truncated: false,
            originalLinesCount: 1,
          };
          state.history.push(currentIteration);
          state.status = "RUNNING";
          continue;
        }
        state.status = "RUNNING";
      }

      // Execute Tool in MicroVM Sandbox
      if (stepInference.toolCall) {
        const observation = await executeCommandActivity(sandboxId, cmd);
        currentIteration.observation = observation;
      }

      state.history.push(currentIteration);
    }

    if (state.currentStep >= maxSteps && state.status !== "COMPLETED") {
      state.status = "TIMED_OUT";
      state.errorMessage = `Exceeded maximum iteration limit of ${maxSteps} steps.`;
    }
  } catch (error: unknown) {
    state.status = "FAILED";
    state.errorMessage = (error as Error).message;

    // Temporal Saga Pattern: Execute compensating transactions on failure
    if (sandboxId) {
      await compensatingTransactionsActivity(sandboxId, request.taskId, (error as Error).message);
    }
  } finally {
    state.endTime = new Date().toISOString();
    if (sandboxId && state.status === "COMPLETED") {
      await destroySandboxActivity(sandboxId);
    }
  }

  return state;
}
