"use client";

import React, { useState } from "react";

export const MemoryInspector: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<"SOUL" | "USER" | "MEMORY" | "EPISODIC">("SOUL");

  const memoryContents = {
    SOUL: `# Hermes-Clawdbot Identity (SOUL.md)
You are Hermes-Clawdbot, an autonomous software engineering execution engine.
- Mission: Solve complex software engineering and DevOps tasks reliably.
- Core Pillars:
  1. MicroVM Ephemeral Isolation: Always execute in isolated Firecracker / E2B sandboxes.
  2. Durable ReAct Loop: Temporal.io guarantees zero state loss across crashes.
  3. AST Context Compaction: Prune logs > 50 lines; maintain Git patch diffs.
  4. Self-Evolution: Synthesize reusable L4 procedural skills after verified runs.`,

    USER: `# User Preferences (USER.md)
- User: Farhan (@farhan4783)
- Primary Languages: TypeScript, Python, Go, Rust
- Test Frameworks: Vitest, Jest, Pytest
- Formatting: Prettier, ESLint, Ruff
- Notification Delivery: Slack, Discord, Telegram, Web Dashboard
- Verbosity: Crisp summaries with unified Git diff snippets`,

    MEMORY: `# Long-Term Curated Knowledge (MEMORY.md)
- [2026-11-07] Verified Repository Practices:
  - In dubinc/dub, slug normalization regex must disallow consecutive hyphens.
  - In expressjs/cors, origin reflection must strictly validate whitelisted origins.
  - In chalk, handle nested ANSI escape sequences properly when styling resets.
- [2026-11-09] Workflow Invariants:
  - Ephemeral microVM boot latency consistently < 480ms on E2B clusters.
  - Git patch differential memory reduces trajectory token usage by 45%.`,

    EPISODIC: `# Episodic Daily Memory Log (memory/2026-11-09.md)
### [2026-11-09T16:45:10Z] Session: slack_C0842_1731170710 (USER)
- Task: Fixed SSRF vulnerability in auth redirect validator.
- Executed 2 ReAct steps inside E2B sandbox (id: e2b_sbx_9941).
- Applied patch to src/lib/auth.ts; test suite passed (exit code 0).
- Learning Loop synthesized skill: workflow-fix-auth-redirect.

### [2026-11-09T18:00:00Z] Session: cron_nightly_audit (CRON)
- Triggered automated dependency audit. Zero critical CVEs detected.`,
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            OpenClaw / Hermes 4-Tier Memory System
          </h3>
          <p className="text-xs text-slate-400">
            File-based, versioned memory with session-kind gating to prevent prompt poisoning.
          </p>
        </div>
        <div className="flex gap-1.5 rounded-lg bg-slate-950 p-1 border border-slate-800">
          {(["SOUL", "USER", "MEMORY", "EPISODIC"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedFile(tab)}
              className={`rounded px-2.5 py-1 text-xs font-mono font-semibold transition ${
                selectedFile === tab
                  ? "bg-sky-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab === "EPISODIC" ? "DAILY LOG" : `${tab}.md`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto max-h-96">
        <pre className="whitespace-pre-wrap">{memoryContents[selectedFile]}</pre>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
        <div className="rounded border border-slate-800 bg-slate-950/50 p-2.5">
          <span className="font-bold text-sky-400">L1/L2 File Memory:</span> Local markdown files in <code>.hermes/workspace/</code>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/50 p-2.5">
          <span className="font-bold text-emerald-400">L3 Vector Memory:</span> Qdrant cosine similarity search
        </div>
        <div className="rounded border border-slate-800 bg-slate-950/50 p-2.5">
          <span className="font-bold text-amber-400">L4 Skills Memory:</span> Auto-synthesized <code>SKILL.md</code> playbooks
        </div>
      </div>
    </div>
  );
};

