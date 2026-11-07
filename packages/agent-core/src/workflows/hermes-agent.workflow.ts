import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
} from "@temporalio/workflow";
import type * as sandboxActivities from "../activities/sandbox.activities.js";
import type * as modelActivities from "../activities/model.activities.js";
import {
  AgentState,
  AgentStepIteration,
  TaskRequest,
  TaskStatus,
} from "@hermes/shared";

const {
  provisionSandboxActivity,
  executeCommandActivity,
  captureGitDiffActivity,
  destroySandboxActivity,
} = proxyActivities<typeof sandboxActivities>({
  startToCloseTimeout: "5 minutes",
  retry: {
    initialInterval: "2 seconds",
    maximumAttempts: 3,
  },
});

const { inferAgentStepActivity, checkAndPerformCompactionActivity } =
  proxyActivities<typeof modelActivities>({
    startToCloseTimeout: "3 minutes",
    retry: {
      initialInterval: "2 seconds",
      maximumAttempts: 3,
    },
  });

// Signals & Queries for real-time interaction
export const cancelTaskSignal = defineSignal("cancelTask");
export const provideFeedbackSignal = defineSignal<[string]>("provideFeedback");
export const getAgentStateQuery = defineQuery<AgentState>("getAgentState");

export async function hermesAgentWorkflow(request: TaskRequest): Promise<AgentState> {
  let isCancelled = false;
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
        ? `${request.prompt}\n[User Provided Input]: ${userFeedback}`
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
        break;
      }

      // Execute Tool in MicroVM Sandbox
      if (stepInference.toolCall) {
        const cmd =
          (stepInference.toolCall.input.command as string) ||
          `cat ${stepInference.toolCall.input.path}`;

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
  } finally {
    state.endTime = new Date().toISOString();
    // Clean up microVM sandbox
    if (sandboxId) {
      await destroySandboxActivity(sandboxId);
    }
  }

  return state;
}
