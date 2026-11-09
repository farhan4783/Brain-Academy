import * as fs from "fs";
import * as path from "path";

export interface MemoryConfig {
  workspaceDir: string;
}

export interface WorkspaceMemoryFiles {
  soul: string;
  user: string;
  memory: string;
  todayLog: string;
}

export class TieredMemoryManager {
  private workspaceDir: string;
  private memoryDir: string;
  private skillsDir: string;

  constructor(config?: Partial<MemoryConfig>) {
    this.workspaceDir =
      config?.workspaceDir ||
      path.join(process.cwd(), ".hermes", "workspace");
    this.memoryDir = path.join(this.workspaceDir, "memory");
    this.skillsDir = path.join(this.workspaceDir, "skills");
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.workspaceDir)) {
      fs.mkdirSync(this.workspaceDir, { recursive: true });
    }
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true });
    }

    // Initialize default SOUL.md if not existing
    const soulPath = path.join(this.workspaceDir, "SOUL.md");
    if (!fs.existsSync(soulPath)) {
      fs.writeFileSync(
        soulPath,
        `# Hermes-Clawdbot Identity (SOUL.md)
You are Hermes-Clawdbot, an autonomous software engineering execution engine.
- Mission: Solve complex software engineering and DevOps tasks reliably.
- Principles:
  1. Never run destructive host commands without authorization.
  2. Always verify code changes via automated tests.
  3. Keep memory clean, factual, and concise.
  4. Learn from successful executions by synthesizing reusable skills.
`
      );
    }

    // Initialize default USER.md if not existing
    const userPath = path.join(this.workspaceDir, "USER.md");
    if (!fs.existsSync(userPath)) {
      fs.writeFileSync(
        userPath,
        `# User Preferences (USER.md)
- Language: TypeScript / Python / Go
- Test Frameworks: Vitest / Jest / Pytest
- Notification Style: Concise status summaries with unified diffs
`
      );
    }

    // Initialize default MEMORY.md if not existing
    const memoryPath = path.join(this.workspaceDir, "MEMORY.md");
    if (!fs.existsSync(memoryPath)) {
      fs.writeFileSync(
        memoryPath,
        `# Long-Term Curated Knowledge (MEMORY.md)
- Verified Repository Practices:
  - Always run lint and typecheck before committing.
  - Preserve backward compatibility for external APIs.
`
      );
    }
  }

  public getWorkspaceFiles(): WorkspaceMemoryFiles {
    const today = new Date().toISOString().split("T")[0];
    const todayLogPath = path.join(this.memoryDir, `${today}.md`);

    const soul = fs.readFileSync(path.join(this.workspaceDir, "SOUL.md"), "utf-8");
    const user = fs.readFileSync(path.join(this.workspaceDir, "USER.md"), "utf-8");
    const memory = fs.readFileSync(path.join(this.workspaceDir, "MEMORY.md"), "utf-8");
    const todayLog = fs.existsSync(todayLogPath)
      ? fs.readFileSync(todayLogPath, "utf-8")
      : "";

    return { soul, user, memory, todayLog };
  }

  /**
   * Appends an entry to today's episodic memory log with session-kind gating.
   * Background crons and heartbeats are tagged to prevent memory poisoning.
   */
  public logEpisodicMemory(
    sessionId: string,
    entry: string,
    sessionKind: "user" | "cron" | "heartbeat" = "user"
  ): void {
    const today = new Date().toISOString().split("T")[0];
    const todayLogPath = path.join(this.memoryDir, `${today}.md`);
    const timestamp = new Date().toISOString();

    const formattedEntry = `\n### [${timestamp}] Session: ${sessionId} (${sessionKind.toUpperCase()})\n${entry}\n`;
    fs.appendFileSync(todayLogPath, formattedEntry, "utf-8");
  }

  /**
   * Appends a permanent, verified fact to MEMORY.md.
   */
  public recordLongTermFact(fact: string): void {
    const memoryPath = path.join(this.workspaceDir, "MEMORY.md");
    const formatted = `\n- [${new Date().toISOString().split("T")[0]}] ${fact}`;
    fs.appendFileSync(memoryPath, formatted, "utf-8");
  }

  /**
   * Assembles the persistent memory context prompt to inject into LLM system prompts.
   */
  public assembleSystemMemoryPrompt(): string {
    const files = this.getWorkspaceFiles();
    return [
      "## Hermes-Clawdbot System Memory (OpenClaw / Hermes 4-Tier Memory Architecture)",
      files.soul.trim(),
      "\n### User Conventions & Profile:",
      files.user.trim(),
      "\n### Long-Term Verified Knowledge:",
      files.memory.trim(),
      files.todayLog
        ? `\n### Today's Episodic Memory Log:\n${files.todayLog.slice(-1500).trim()}`
        : "",
    ].join("\n");
  }
}
