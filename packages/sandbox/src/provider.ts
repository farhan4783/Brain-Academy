import { SandboxExecutionOptions, ToolExecutionResult } from "@hermes/shared";

export type StreamCallback = (chunk: string, streamType: "stdout" | "stderr") => void;

export interface SandboxInstance {
  readonly id: string;
  readonly isAlive: boolean;

  /**
   * Execute arbitrary bash command inside the microVM sandbox.
   * Supports live output streaming via callback.
   */
  executeCommand(
    command: string,
    options?: SandboxExecutionOptions,
    onOutput?: StreamCallback
  ): Promise<ToolExecutionResult>;

  /**
   * Reads a file from the sandbox filesystem.
   */
  readFile(filePath: string): Promise<string>;

  /**
   * Writes content to a file inside the sandbox filesystem.
   */
  writeFile(filePath: string, content: string): Promise<void>;

  /**
   * Clones or initializes git repository state inside the sandbox.
   */
  mountRepository(repoUrl: string, branch?: string): Promise<void>;

  /**
   * Captures git diff of modified files in the sandbox workspace.
   */
  getGitDiff(): Promise<string>;

  /**
   * Freezes/snapshots environment state for post-mortem debugging.
   */
  snapshotState(label: string): Promise<string>;

  /**
   * Gracefully terminates and cleans up the microVM sandbox.
   */
  destroy(): Promise<void>;
}

export interface SandboxProvider {
  /**
   * Provisions a brand new ephemeral sandbox in < 500ms.
   */
  createSandbox(taskId: string, timeoutMs?: number): Promise<SandboxInstance>;

  /**
   * Reconnects to an existing live sandbox across node restarts.
   */
  reconnectSandbox(sandboxId: string): Promise<SandboxInstance | null>;
}
