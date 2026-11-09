import { createSandboxProvider, SandboxInstance } from "@hermes/sandbox";
import { ObservationTruncator } from "@hermes/context-engine";
import { ToolExecutionResult } from "@hermes/shared";

// In-memory registry to hold active sandboxes for worker activities
const activeSandboxPool = new Map<string, SandboxInstance>();

export async function provisionSandboxActivity(
  taskId: string,
  repoUrl?: string,
  branch?: string
): Promise<{ sandboxId: string }> {
  const provider = createSandboxProvider();
  const sandbox = await provider.createSandbox(taskId);
  activeSandboxPool.set(sandbox.id, sandbox);

  if (repoUrl) {
    await sandbox.mountRepository(repoUrl, branch);
  }

  return { sandboxId: sandbox.id };
}

export async function executeCommandActivity(
  sandboxId: string,
  command: string,
  options?: { cwd?: string; timeoutMs?: number }
): Promise<ToolExecutionResult> {
  let sandbox = activeSandboxPool.get(sandboxId);
  if (!sandbox) {
    const provider = createSandboxProvider();
    const reconnected = await provider.reconnectSandbox(sandboxId);
    if (!reconnected) {
      throw new Error(`Failed to reconnect to active sandbox ${sandboxId} following crash.`);
    }
    sandbox = reconnected;
    activeSandboxPool.set(sandboxId, sandbox);
  }

  const rawResult = await sandbox.executeCommand(command, options);

  // Pass through AST-guided observation truncator to prevent context blowup (>50 lines)
  const truncatedResult = ObservationTruncator.truncate(rawResult, { maxLines: 50 });
  return truncatedResult;
}

export async function captureGitDiffActivity(sandboxId: string): Promise<string> {
  const sandbox = activeSandboxPool.get(sandboxId);
  if (!sandbox) return "";
  return await sandbox.getGitDiff();
}

export async function snapshotSandboxActivity(
  sandboxId: string,
  label: string
): Promise<string> {
  const sandbox = activeSandboxPool.get(sandboxId);
  if (!sandbox) return "";
  return await sandbox.snapshotState(label);
}

export async function destroySandboxActivity(sandboxId: string): Promise<void> {
  const sandbox = activeSandboxPool.get(sandboxId);
  if (sandbox) {
    await sandbox.destroy();
    activeSandboxPool.delete(sandboxId);
  }
}

export async function compensatingTransactionsActivity(
  sandboxId: string,
  taskId: string,
  reason: string
): Promise<{ snapshotId?: string }> {
  console.log(`[Temporal Saga] Executing compensating transactions for failed task ${taskId}...`);
  const sandbox = activeSandboxPool.get(sandboxId);
  let snapshotId: string | undefined;

  if (sandbox) {
    try {
      snapshotId = await sandbox.snapshotState(`failure_${Date.now()}`);
      console.log(`[Temporal Saga] Captured failure post-mortem snapshot: ${snapshotId}`);
    } catch {
      // Best effort
    }
    await sandbox.destroy().catch(() => {});
    activeSandboxPool.delete(sandboxId);
  }

  return { snapshotId };
}


