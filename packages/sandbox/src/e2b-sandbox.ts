import { Sandbox } from "@e2b/code-interpreter";
import { SandboxExecutionOptions, ToolExecutionResult } from "@hermes/shared";
import { SandboxInstance, SandboxProvider, StreamCallback } from "./provider.js";

export class E2BSandboxInstance implements SandboxInstance {
  private sandbox: Sandbox;
  private _isAlive = true;

  constructor(sandbox: Sandbox) {
    this.sandbox = sandbox;
  }

  get id(): string {
    return this.sandbox.sandboxId;
  }

  get isAlive(): boolean {
    return this._isAlive;
  }

  async executeCommand(
    command: string,
    options?: SandboxExecutionOptions,
    onOutput?: StreamCallback
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    let stdoutBuffer = "";
    let stderrBuffer = "";

    try {
      const exec = await this.sandbox.commands.run(command, {
        cwd: options?.cwd || "/home/user/workspace",
        envs: options?.env,
        timeoutMs: options?.timeoutMs || 120000,
        onStdout: (chunk) => {
          stdoutBuffer += chunk;
          if (onOutput) onOutput(chunk, "stdout");
        },
        onStderr: (chunk) => {
          stderrBuffer += chunk;
          if (onOutput) onOutput(chunk, "stderr");
        },
      });

      const durationMs = Date.now() - startTime;
      const originalLines = (stdoutBuffer + stderrBuffer).split("\n").length;

      return {
        toolCallId: `call_${Date.now()}`,
        stdout: stdoutBuffer,
        stderr: stderrBuffer,
        exitCode: exec.exitCode ?? 0,
        durationMs,
        truncated: false,
        originalLinesCount: originalLines,
      };
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime;
      const err = error as Error;
      return {
        toolCallId: `call_err_${Date.now()}`,
        stdout: stdoutBuffer,
        stderr: stderrBuffer ? `${stderrBuffer}\n${err.message}` : err.message,
        exitCode: 1,
        durationMs,
        truncated: false,
        originalLinesCount: (stdoutBuffer + err.message).split("\n").length,
      };
    }
  }

  async readFile(filePath: string): Promise<string> {
    return await this.sandbox.files.read(filePath);
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await this.sandbox.files.write(filePath, content);
  }

  async mountRepository(repoUrl: string, branch = "main"): Promise<void> {
    await this.executeCommand(`mkdir -p /home/user/workspace`);
    await this.executeCommand(
      `git clone --depth 1 -b ${branch} ${repoUrl} /home/user/workspace || git clone ${repoUrl} /home/user/workspace`
    );
  }

  async getGitDiff(): Promise<string> {
    const result = await this.executeCommand("git diff HEAD", {
      cwd: "/home/user/workspace",
    });
    return result.stdout;
  }

  async snapshotState(label: string): Promise<string> {
    // E2B or custom snapshot snapshot logic
    const snapshotId = `snap_${this.id}_${label}_${Date.now()}`;
    return snapshotId;
  }

  async destroy(): Promise<void> {
    if (!this._isAlive) return;
    try {
      await this.sandbox.kill();
    } finally {
      this._isAlive = false;
    }
  }
}

export class E2BSandboxProvider implements SandboxProvider {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.E2B_API_KEY;
  }

  async createSandbox(taskId: string, timeoutMs = 1800000): Promise<SandboxInstance> {
    // Sub-500ms provision via E2B microVMs
    const sandbox = await Sandbox.create({
      apiKey: this.apiKey,
      timeoutMs,
      metadata: { taskId },
    });
    return new E2BSandboxInstance(sandbox);
  }

  async reconnectSandbox(sandboxId: string): Promise<SandboxInstance | null> {
    try {
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey: this.apiKey,
      });
      return new E2BSandboxInstance(sandbox);
    } catch {
      return null;
    }
  }
}

