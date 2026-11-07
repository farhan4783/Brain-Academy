import { z } from "zod";

export type PlatformOrigin = "slack" | "discord" | "cli" | "web";

export type ModelTier = "tier1_fast" | "tier2_reasoning" | "tier2_deep_reasoning";

export type SandboxProviderType = "e2b" | "firecracker" | "docker";

export type TaskStatus =
  | "PENDING"
  | "INITIALIZING_SANDBOX"
  | "RUNNING"
  | "AWAITING_USER_INPUT"
  | "COMPACTING_CONTEXT"
  | "VERIFYING_TESTS"
  | "COMPLETED"
  | "FAILED"
  | "TIMED_OUT";

export interface TaskPlatformMeta {
  origin: PlatformOrigin;
  channelId?: string;
  userId: string;
  threadId?: string;
  responseWebhook?: string;
}

export interface TaskRequest {
  taskId: string;
  prompt: string;
  repoUrl?: string;
  repoBranch?: string;
  platformMeta: TaskPlatformMeta;
  maxIterations?: number;
  timeoutSeconds?: number;
}

export interface ToolCallSpec {
  id: string;
  name: "bash" | "read_file" | "write_file" | "git_diff" | "run_tests" | "search_code";
  input: Record<string, unknown>;
}

export interface ToolExecutionResult {
  toolCallId: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  truncated: boolean;
  originalLinesCount: number;
}

export interface AgentStepIteration {
  stepNumber: number;
  thought: string;
  toolCall?: ToolCallSpec;
  observation?: ToolExecutionResult;
  selectedTier: ModelTier;
  tokenCount: number;
  timestamp: string;
}

export interface CompactionSummary {
  compactedAtStep: number;
  retainedKeyFindings: string[];
  activeFileModifications: Record<string, string>; // File path -> Git diff patch
  discardedTokensCount: number;
  compressedContextPrompt: string;
}

export interface AgentState {
  taskId: string;
  status: TaskStatus;
  currentStep: number;
  history: AgentStepIteration[];
  compactedHistory?: CompactionSummary;
  sandboxId?: string;
  gitPatchAccumulator: string[]; // Accumulated git patches
  totalTokensUsed: number;
  totalCostUsd: number;
  startTime: string;
  endTime?: string;
  errorMessage?: string;
}

export interface SandboxExecutionOptions {
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
}

export interface EvalCase {
  id: string;
  repoName: string;
  repoCommit: string;
  issueDescription: string;
  testCommand: string;
  expectedPassingTests: string[];
}

export interface EvalResult {
  evalId: string;
  taskId: string;
  resolved: boolean;
  durationSeconds: number;
  totalTokens: number;
  costUsd: number;
  testOutput: string;
  patchApplied: string;
}
