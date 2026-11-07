"use client";

import React from "react";

interface DiffViewerProps {
  diffText: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diffText }) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Git Patch Differential Memory
        </h3>
        <span className="text-xs text-slate-500">AST Compaction Active</span>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs">
        {diffText ? (
          <pre className="max-h-60 overflow-y-auto whitespace-pre leading-relaxed text-slate-300">
            {diffText.split("\n").map((line, idx) => {
              let color = "text-slate-300";
              if (line.startsWith("+")) color = "text-emerald-400 bg-emerald-950/30";
              else if (line.startsWith("-")) color = "text-rose-400 bg-rose-950/30";
              else if (line.startsWith("@")) color = "text-sky-400";
              return (
                <div key={idx} className={`${color} px-1 rounded`}>
                  {line}
                </div>
              );
            })}
          </pre>
        ) : (
          <span className="text-slate-500">No active code diffs in sandbox memory.</span>
        )}
      </div>
    </div>
  );
};
