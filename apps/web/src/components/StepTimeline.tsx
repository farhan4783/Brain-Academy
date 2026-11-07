"use client";

import React from "react";
import { AgentStepIteration } from "@hermes/shared";

interface StepTimelineProps {
  steps: AgentStepIteration[];
}

export const StepTimeline: React.FC<StepTimelineProps> = ({ steps }) => {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
        ReAct Execution Trajectory (Temporal Event Log)
      </h3>
      {steps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
          No steps executed yet. Submit a task to begin.
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.stepNumber}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-slate-700"
            >
              <div className="flex items-center justify-between pb-2">
                <span className="inline-flex items-center gap-2 font-mono text-xs font-bold text-sky-400">
                  Step {step.stepNumber}
                  <span className="rounded bg-sky-950 px-2 py-0.5 text-[10px] text-sky-300">
                    {step.selectedTier}
                  </span>
                </span>
                <span className="font-mono text-xs text-slate-500">{step.timestamp}</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                <strong className="text-slate-400">Thought:</strong> {step.thought}
              </p>
              {step.toolCall && (
                <div className="mt-2 rounded bg-black/40 p-2 font-mono text-[11px] text-amber-300">
                  <span className="text-slate-400">Tool Call: </span>
                  {step.toolCall.name} {JSON.stringify(step.toolCall.input)}
                </div>
              )}
              {step.observation && (
                <div className="mt-2 rounded bg-black/50 p-2 font-mono text-[11px] text-emerald-300">
                  <div className="text-slate-400">
                    Observation (Exit {step.observation.exitCode} | {step.observation.durationMs}ms
                    {step.observation.truncated ? " | AST-Truncated" : ""}):
                  </div>
                  <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {step.observation.stdout || step.observation.stderr}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

