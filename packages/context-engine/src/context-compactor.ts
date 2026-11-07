import { AgentStepIteration, CompactionSummary } from "@hermes/shared";
import { GitPatchMemory } from "./git-patch-memory.js";

export interface CompactionInput {
  history: AgentStepIteration[];
  gitPatchMemory: GitPatchMemory;
  currentStep: number;
}

export class ContextCompactor {
  /**
   * Compresses prior conversation history into a structured semantic checkpoint:
   * 1. Summarizes high-level problem and attempted hypotheses.
   * 2. Retains discovered error causes and codebase discoveries.
   * 3. Prunes intermediate verbose tool observations while keeping recent steps.
   * 4. Synthesizes active git diff patches.
   */
  public static compact(
    input: CompactionInput,
    summarizerFn?: (prompt: string) => Promise<string>
  ): CompactionSummary {
    const { history, gitPatchMemory, currentStep } = input;

    // Separate older steps from the most recent 3 steps
    const keepRecentCount = 3;
    const stepsToCompress = history.slice(0, -keepRecentCount);

    const keyFindings: string[] = [];
    const attemptedApproaches: string[] = [];

    for (const step of stepsToCompress) {
      if (step.thought) {
        attemptedApproaches.push(`Step ${step.stepNumber}: ${step.thought.slice(0, 200)}`);
      }
      if (step.observation) {
        if (step.observation.exitCode !== 0) {
          keyFindings.push(`Failure in step ${step.stepNumber} [${step.toolCall?.name}]: Exit code ${step.observation.exitCode}`);
        } else if (step.toolCall?.name === "read_file") {
          keyFindings.push(`Inspected file: ${JSON.stringify(step.toolCall.input)}`);
        }
      }
    }

    const activePatches = gitPatchMemory.getPatches();

    const structuredSummaryText = [
      `### Context Compaction Checkpoint (Step ${currentStep})`,
      `#### Historical Trajectory Summary:`,
      attemptedApproaches.slice(-8).map((a) => `- ${a}`).join("\n") || "- Initial discovery phase completed.",
      `#### Key Technical Discoveries & Errors:`,
      keyFindings.slice(-6).map((k) => `- ${k}`).join("\n") || "- Repository explored; baseline issues isolated.",
      `#### Code Modifications Applied So Far:`,
      Object.keys(activePatches).length > 0
        ? Object.keys(activePatches).map((f) => `- ${f} (modified via git patch)`).join("\n")
        : "- No files committed or modified yet.",
    ].join("\n");

    return {
      compactedAtStep: currentStep,
      retainedKeyFindings: keyFindings,
      activeFileModifications: activePatches,
      discardedTokensCount: stepsToCompress.length * 600, // Estimated pruned tokens
      compressedContextPrompt: structuredSummaryText,
    };
  }
}
