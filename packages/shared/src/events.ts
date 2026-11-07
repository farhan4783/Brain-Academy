import { AgentStepIteration, TaskStatus, ToolExecutionResult } from "./types.js";

export type HermesEventType =
  | "TASK_SUBMITTED"
  | "SANDBOX_READY"
  | "STEP_STARTED"
  | "THOUGHT_GENERATED"
  | "TOOL_EXECUTION_STARTED"
  | "TOOL_STREAM_STDOUT"
  | "TOOL_STREAM_STDERR"
  | "TOOL_EXECUTION_FINISHED"
  | "CONTEXT_COMPACTION_TRIGGERED"
  | "TASK_PROGRESS_UPDATE"
  | "TASK_SUCCEEDED"
  | "TASK_FAILED";

export interface HermesEventPayload<T = unknown> {
  eventType: HermesEventType;
  taskId: string;
  timestamp: string;
  data: T;
}

export interface StreamOutputPayload {
  stream: "stdout" | "stderr";
  chunk: string;
}

export interface StepUpdatePayload {
  step: AgentStepIteration;
  status: TaskStatus;
}
