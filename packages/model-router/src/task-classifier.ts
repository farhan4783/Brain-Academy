import { ModelTier } from "@hermes/shared";

export type SubTaskCategory =
  | "FILE_READ"
  | "BASH_GENERATION"
  | "FORMATTING"
  | "SYNTAX_CHECK"
  | "COMPLEX_DEBUGGING"
  | "ARCHITECTURE_REFACTOR"
  | "STRATEGY_FORMULATION";

export class TaskComplexityClassifier {
  /**
   * Evaluates the active step context and agent goal to assign optimal model tier.
   * Simple operations go to Tier 1 (Haiku / Llama 3)
   * Complex diagnosis & refactoring escalate to Tier 2 (Sonnet 3.5 / DeepSeek-R1)
   */
  public static classify(input: {
    lastObservationExitCode?: number;
    consecutiveFailures?: number;
    stepNumber: number;
    lastToolUsed?: string;
    actionIntent?: string;
  }): { tier: ModelTier; category: SubTaskCategory; reason: string } {
    const { lastObservationExitCode, consecutiveFailures = 0, stepNumber, lastToolUsed, actionIntent = "" } = input;

    // High failure count indicates difficult bug -> Escalate to deep reasoning tier
    if (consecutiveFailures >= 2) {
      return {
        tier: "tier2_deep_reasoning",
        category: "COMPLEX_DEBUGGING",
        reason: `Repeated failures detected (${consecutiveFailures} consecutive). Escalating to Tier 2 Deep Reasoning model.`,
      };
    }

    // Bug diagnosis or refactoring keywords
    const lowerIntent = actionIntent.toLowerCase();
    if (
      lowerIntent.includes("refactor") ||
      lowerIntent.includes("diagnose") ||
      lowerIntent.includes("architect") ||
      lowerIntent.includes("root cause") ||
      lastObservationExitCode !== 0 && lastObservationExitCode !== undefined
    ) {
      return {
        tier: "tier2_reasoning",
        category: "COMPLEX_DEBUGGING",
        reason: "Complex reasoning or error diagnosis required.",
      };
    }

    // Routine steps: file reading, simple bash execution, formatting
    if (stepNumber > 1 && (lastToolUsed === "read_file" || lastToolUsed === "search_code")) {
      return {
        tier: "tier1_fast",
        category: "BASH_GENERATION",
        reason: "Standard tool command synthesis and routine file inspection.",
      };
    }

    // Default to Tier 1 for routine operations, initial strategy planning uses Tier 2
    if (stepNumber === 1) {
      return {
        tier: "tier2_reasoning",
        category: "STRATEGY_FORMULATION",
        reason: "Initial task planning and trajectory formulation.",
      };
    }

    return {
      tier: "tier1_fast",
      category: "BASH_GENERATION",
      reason: "Execution of deterministic sub-task.",
    };
  }
}

