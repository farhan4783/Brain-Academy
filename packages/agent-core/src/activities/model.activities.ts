import {
  DynamicModelRouter,
  TaskComplexityClassifier,
} from "@hermes/model-router";
import {
  ContextCompactor,
  GitPatchMemory,
  TokenBudgeter,
} from "@hermes/context-engine";
import {
  AgentStepIteration,
  CompactionSummary,
  ModelTier,
  ToolCallSpec,
} from "@hermes/shared";
import {
  TieredMemoryManager,
  SkillRegistry,
  HermesLearningLoop,
} from "@hermes/memory";

const router = new DynamicModelRouter();
const budgeter = new TokenBudgeter();
const memoryManager = new TieredMemoryManager();
const skillRegistry = new SkillRegistry();
const learningLoop = new HermesLearningLoop(skillRegistry);

export interface StepInferenceInput {
  taskPrompt: string;
  stepNumber: number;
  history: AgentStepIteration[];
  compactedHistory?: CompactionSummary;
  rawGitDiff: string;
  totalTokensUsed: number;
  totalCostUsd: number;
}

export interface StepInferenceOutput {
  thought: string;
  toolCall?: ToolCallSpec;
  isComplete: boolean;
  selectedTier: ModelTier;
  stepTokens: number;
  stepCost: number;
}

export async function checkAndPerformCompactionActivity(input: {
  currentStep: number;
  history: AgentStepIteration[];
  rawGitDiff: string;
  totalTokens: number;
}): Promise<CompactionSummary | null> {
  const needsCompaction = budgeter.shouldCompact(input.totalTokens);
  if (!needsCompaction) return null;

  const gitMemory = new GitPatchMemory();
  gitMemory.ingestRawGitDiff(input.rawGitDiff);

  return ContextCompactor.compact({
    history: input.history,
    gitPatchMemory: gitMemory,
    currentStep: input.currentStep,
  });
}

export async function inferAgentStepActivity(
  input: StepInferenceInput
): Promise<StepInferenceOutput> {
  const lastStep = input.history[input.history.length - 1];

  // Dynamic model routing classification
  const classification = TaskComplexityClassifier.classify({
    lastObservationExitCode: lastStep?.observation?.exitCode,
    consecutiveFailures: lastStep?.observation?.exitCode !== 0 ? 1 : 0,
    stepNumber: input.stepNumber,
    lastToolUsed: lastStep?.toolCall?.name,
  });

  const systemMemoryPrompt = memoryManager.assembleSystemMemoryPrompt();
  const skillsCatalogPrompt = skillRegistry.getCatalogPrompt();

  const systemPrompt = `You are Hermes-Clawdbot, an autonomous software engineering execution engine.
Your goal is to solve the user's task in an ephemeral microVM sandbox.
Rules:
1. Always state your reasoning in a <thought> tag.
2. Select an action formatted as JSON tool call: {"name": "bash" | "read_file" | "write_file" | "run_tests", "input": {...}}.
3. When the task is verified and solved, output <complete>true</complete>.

${systemMemoryPrompt}

${skillsCatalogPrompt}
`;

  const contextMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

  if (input.compactedHistory) {
    contextMessages.push({
      role: "system",
      content: input.compactedHistory.compressedContextPrompt,
    });
  }

  // Active Git Diff Memory
  if (input.rawGitDiff) {
    contextMessages.push({
      role: "system",
      content: `### Active Workspace Git Diff:\n\`\`\`diff\n${input.rawGitDiff.slice(0, 4000)}\n\`\`\``,
    });
  }

  // Trajectory history
  const recentHistory = input.history.slice(-4);
  for (const step of recentHistory) {
    contextMessages.push({
      role: "assistant",
      content: `<thought>${step.thought}</thought>\nTool Call: ${JSON.stringify(step.toolCall)}`,
    });
    if (step.observation) {
      contextMessages.push({
        role: "user",
        content: `Observation (exit code ${step.observation.exitCode}):\n${step.observation.stdout}`,
      });
    }
  }

  contextMessages.push({
    role: "user",
    content: `User Goal: ${input.taskPrompt}\nCurrent Step: ${input.stepNumber}. What is your next thought and action?`,
  });

  const completion = await router.complete(
    systemPrompt,
    contextMessages,
    classification.tier,
    input.totalTokensUsed,
    input.totalCostUsd
  );

  const thoughtMatch = completion.content.match(/<thought>([\s\S]*?)<\/thought>/);
  const thought = thoughtMatch ? thoughtMatch[1]!.trim() : completion.content.slice(0, 300);
  const isComplete = completion.content.includes("<complete>true</complete>");

  // Extract JSON tool call
  let toolCall: ToolCallSpec | undefined;
  const jsonMatch = completion.content.match(/\{[\s\S]*"name"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      toolCall = JSON.parse(jsonMatch[0]);
    } catch {
      // Fallback
    }
  }

  if (!toolCall && !isComplete) {
    toolCall = {
      id: `call_${Date.now()}`,
      name: "bash",
      input: { command: "ls -la" },
    };
  }

  return {
    thought,
    toolCall,
    isComplete,
    selectedTier: classification.tier,
    stepTokens: completion.promptTokens + completion.completionTokens,
    stepCost: completion.costUsd,
  };
}

export async function reflectAndSynthesizeSkillActivity(input: {
  taskPrompt: string;
  history: AgentStepIteration[];
  success: boolean;
}): Promise<{ skillName: string; filePath: string } | null> {
  const result = await learningLoop.reflectAndSynthesize(input);
  if (result) {
    memoryManager.recordLongTermFact(
      `Synthesized procedural skill '${result.skillName}' after resolving: ${input.taskPrompt}`
    );
    return { skillName: result.skillName, filePath: result.filePath };
  }
  return null;
}


