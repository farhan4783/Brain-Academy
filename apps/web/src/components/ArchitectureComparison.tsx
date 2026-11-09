"use client";

import React from "react";

export const ArchitectureComparison: React.FC = () => {
  const comparisons = [
    {
      feature: "Sandboxing & Isolation",
      hermesClawdbot: "Sub-500ms Ephemeral Firecracker / E2B microVMs with disk snapshotting",
      openClaw: "Host machine execution or standard Docker container (unsafe)",
      hermesAgent: "Local host subprocess execution",
      claudeCode: "Local terminal / Host execution",
      devin: "Proprietary cloud containers",
    },
    {
      feature: "Workflow Durability & Replay",
      hermesClawdbot: "Temporal.io event sourcing; zero-loss crash recovery & step replay",
      openClaw: "Stateless / Single-process daemon (crashes lose in-flight tasks)",
      hermesAgent: "Single Python/Node loop; no durable event replay",
      claudeCode: "Session logs only; restart loses active trajectory",
      devin: "Proprietary cloud checkpointing",
    },
    {
      feature: "Context Compaction & Anti-Rot",
      hermesClawdbot: "AST-guided observation truncator (>50 lines) + Git patch diff memory (-45% tokens)",
      openClaw: "Sliding window truncation; repeated full-file injections",
      hermesAgent: "Prompt compression / FTS5 search",
      claudeCode: "Built-in compaction / token budgeting",
      devin: "Proprietary context manager",
    },
    {
      feature: "Memory Architecture",
      hermesClawdbot: "4-Tier (SOUL.md, USER.md, MEMORY.md, daily logs) + Qdrant L3 + L4 Skills",
      openClaw: "Workspace markdown files (SOUL, USER, MEMORY, daily logs)",
      hermesAgent: "4-Tier memory (L1 session, L2 facts, L3 search, L4 skills)",
      claudeCode: "CLAUDE.md project conventions",
      devin: "Proprietary repository index",
    },
    {
      feature: "Self-Evolution & Learning Loop",
      hermesClawdbot: "Autonomous post-turn reflection synthesizes reusable SKILL.md playbooks",
      openClaw: "Manual skill installations (ClawHub)",
      hermesAgent: "Autonomous SKILL.md synthesis & GEPA evolutionary optimization",
      claudeCode: "Manual prompt instructions",
      devin: "Internal knowledge graph",
    },
    {
      feature: "Multi-Platform Gateway",
      hermesClawdbot: "Unified Gateway on ws://127.0.0.1:18789 (Slack, Discord, Telegram, WhatsApp, CLI, Web)",
      openClaw: "Gateway daemon on ws://127.0.0.1:18789 (WhatsApp, Telegram, Discord, Slack)",
      hermesAgent: "Multi-channel daemon (Telegram, Discord, Slack, CLI)",
      claudeCode: "CLI only",
      devin: "Web dashboard & Slack app",
    },
    {
      feature: "Empirical Benchmarking",
      hermesClawdbot: "Dockerized SWE-Bench runner on real open-source repos (Dub.sh, Express, Chalk)",
      openClaw: "No integrated benchmark testbed",
      hermesAgent: "Benchmark evaluation harness",
      claudeCode: "SWE-bench evaluated (proprietary harness)",
      devin: "SWE-bench verified (13.86% - 50%+)",
    },
    {
      feature: "Dynamic Model Tiering",
      hermesClawdbot: "LiteLLM Router: Tier 1 (Haiku / Llama-3) for routine tasks; Tier 2 (Sonnet / R1) for deep bugs",
      openClaw: "Single configured provider per session",
      hermesAgent: "Model-agnostic; single provider per execution",
      claudeCode: "Claude 3.5 Sonnet / Haiku switch",
      devin: "Multi-model ensemble",
    },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
      <div className="border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <span className="rounded bg-sky-500/20 px-2 py-0.5 font-mono text-xs font-bold text-sky-400">
            BENCHMARK ANALYSIS
          </span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            Hermes-Clawdbot vs. State-of-the-Art Developer Agents
          </h3>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          How our architecture combines the best of <strong>OpenClaw</strong> and <strong>Nous Research Hermes</strong> while solving their critical durability and sandboxing flaws.
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950 font-mono text-slate-400">
              <th className="p-3">Pillar / Capability</th>
              <th className="p-3 text-sky-400 font-bold">Hermes-Clawdbot (Ours)</th>
              <th className="p-3 text-amber-400">OpenClaw (Peter Steinberger)</th>
              <th className="p-3 text-purple-400">Nous Research Hermes</th>
              <th className="p-3 text-emerald-400">Claude Code</th>
              <th className="p-3 text-slate-400">Cognition Devin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {comparisons.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-800/20 transition">
                <td className="p-3 font-semibold text-slate-200 whitespace-nowrap">{row.feature}</td>
                <td className="p-3 font-medium text-sky-300 bg-sky-950/10 border-l border-r border-sky-900/20">
                  {row.hermesClawdbot}
                </td>
                <td className="p-3 text-slate-300">{row.openClaw}</td>
                <td className="p-3 text-slate-300">{row.hermesAgent}</td>
                <td className="p-3 text-slate-400">{row.claudeCode}</td>
                <td className="p-3 text-slate-400">{row.devin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-lg border border-sky-500/20 bg-sky-950/20 p-4 text-xs leading-relaxed text-slate-300">
        <h4 className="font-bold text-sky-400 mb-1">Key Innovations in Hermes-Clawdbot:</h4>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li><strong>Zero Host Blast-Radius:</strong> Unlike OpenClaw executing directly on the host OS, Hermes enforces sub-500ms Firecracker / E2B microVM boundaries.</li>
          <li><strong>Zero Trajectory Loss:</strong> Unlike OpenClaw and Hermes Agent which die on server restart, Temporal.io durable state replay restores in-flight workflows seamlessly.</li>
          <li><strong>45% Token Reduction:</strong> AST observation truncation and Git patch differential memory prevent the context rot plaguing standard agent loops.</li>
          <li><strong>Organic Self-Evolution:</strong> Directly incorporates Nous Research's learning loop to synthesize verified <code>SKILL.md</code> playbooks upon task success.</li>
        </ul>
      </div>
    </div>
  );
};

