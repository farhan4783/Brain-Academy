import { AgentStepIteration } from "@hermes/shared";
import { SkillRegistry } from "./skill-registry.js";

export interface ReflectionInput {
  taskPrompt: string;
  history: AgentStepIteration[];
  success: boolean;
}

export interface SynthesizedSkillResult {
  skillName: string;
  filePath: string;
  description: string;
  synthesized: boolean;
}

export class HermesLearningLoop {
  private registry: SkillRegistry;

  constructor(registry?: SkillRegistry) {
    this.registry = registry || new SkillRegistry();
  }

  /**
   * Evaluates a completed trajectory and synthesizes reusable procedural knowledge.
   * Based on Nous Research Hermes Agent self-evolution architecture.
   */
  public async reflectAndSynthesize(
    input: ReflectionInput,
    llmSynthesizer?: (prompt: string) => Promise<string>
  ): Promise<SynthesizedSkillResult | null> {
    // Only synthesize skills from successful runs with multiple tool steps
    if (!input.success || input.history.length < 3) {
      return null;
    }

    const successfulCommands = input.history
      .filter((s) => s.toolCall && s.observation?.exitCode === 0)
      .map((s) => `${s.toolCall?.name}: ${JSON.stringify(s.toolCall?.input)}`);

    if (successfulCommands.length < 2) {
      return null;
    }

    const slug = input.taskPrompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 30)
      .replace(/^-|-$/g, "");

    const skillName = `workflow-${slug || "automated-task"}`;
    const description = `Procedural playbook synthesized from task: "${input.taskPrompt}"`;

    const instructionsBody = [
      `# ${skillName}`,
      "",
      `## Overview`,
      `This skill was autonomously synthesized by Hermes-Clawdbot's self-evolution learning loop.`,
      `Original Goal: ${input.taskPrompt}`,
      "",
      `## Validated Execution Procedure:`,
      ...successfulCommands.map((cmd, i) => `${i + 1}. Execute \`${cmd}\``),
      "",
      `## Verification Steps:`,
      `- Ensure test exit code is 0 before marking complete.`,
      `- Inspect git diff patches for unintended side effects.`,
    ].join("\n");

    const filePath = this.registry.saveSkill(
      skillName,
      { description, tags: ["synthesized", "autonomous-learning"] },
      instructionsBody
    );

    return {
      skillName,
      filePath,
      description,
      synthesized: true,
    };
  }
}
