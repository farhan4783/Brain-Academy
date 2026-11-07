"use client";

import React from "react";

interface TokenBudgetGaugeProps {
  currentTokens: number;
  maxTokens: number;
  costUsd: number;
}

export const TokenBudgetGauge: React.FC<TokenBudgetGaugeProps> = ({
  currentTokens,
  maxTokens,
  costUsd,
}) => {
  const percentage = Math.min(100, Math.round((currentTokens / maxTokens) * 100));
  const isCompacted = percentage >= 75;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Token Budget & Anti-Rot Engine
        </span>
        <span className="font-mono text-xs font-bold text-amber-400">
          ${costUsd.toFixed(4)} USD
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
        <span>{currentTokens.toLocaleString()} tokens</span>
        <span>{maxTokens.toLocaleString()} limit (75% compaction trigger)</span>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full transition-all duration-500 ${
            isCompacted ? "bg-rose-500" : percentage > 50 ? "bg-amber-500" : "bg-sky-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {isCompacted && (
        <div className="mt-2 text-[11px] font-medium text-rose-400">
          ⚠️ 75% Threshold Exceeded: Context Compaction & AST observation pruning triggered!
        </div>
      )}
    </div>
  );
};
