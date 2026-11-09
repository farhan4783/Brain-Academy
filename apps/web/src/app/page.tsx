"use client";

import React, { useState } from "react";
import { TerminalStream } from "../components/TerminalStream";
import { StepTimeline } from "../components/StepTimeline";
import { DiffViewer } from "../components/DiffViewer";
import { TokenBudgetGauge } from "../components/TokenBudgetGauge";
import { MemoryInspector } from "../components/MemoryInspector";
import { SkillsCatalogView } from "../components/SkillsCatalogView";
import { ArchitectureComparison } from "../components/ArchitectureComparison";
import { AgentStepIteration } from "@hermes/shared";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"LIVE" | "MEMORY" | "SKILLS" | "COMPARISON">("LIVE");
  const [taskPrompt, setTaskPrompt] = useState(
    "Fix bug in auth handler: normalize redirect URI to prevent SSRF vulnerabilities"
  );
  const [repoUrl, setRepoUrl] = useState("https://github.com/dubinc/dub.git");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "Provisioning microVM sandbox via E2B cluster (128ms)...",
    "Sandbox mounted: /home/user/workspace",
    "Temporal workflow hermes-task-001 registered on task queue.",
    "Gateway WebSocket RPC ready on ws://127.0.0.1:18789.",
  ]);

  const [steps, setSteps] = useState<AgentStepIteration[]>([
    {
      stepNumber: 1,
      thought:
        "Initial task analysis: I need to inspect auth handler redirect normalization in src/lib/auth.ts and locate SSRF checks.",
      toolCall: {
        id: "call_1",
        name: "bash",
        input: { command: "git status && ls -la src/lib" },
      },
      observation: {
        toolCallId: "call_1",
        stdout: "On branch main\nnothing to commit, working tree clean\nsrc/lib/auth.ts\nsrc/lib/middleware.ts",
        stderr: "",
        exitCode: 0,
        durationMs: 240,
        truncated: false,
        originalLinesCount: 4,
      },
      selectedTier: "tier2_reasoning",
      tokenCount: 1450,
      timestamp: "16:45:10",
    },
    {
      stepNumber: 2,
      thought:
        "Reading src/lib/auth.ts to locate the redirect URI validation regex. Using Tier 1 model for routine read.",
      toolCall: {
        id: "call_2",
        name: "read_file",
        input: { path: "src/lib/auth.ts" },
      },
      observation: {
        toolCallId: "call_2",
        stdout: "export function validateRedirect(url: string) { ... }",
        stderr: "",
        exitCode: 0,
        durationMs: 110,
        truncated: false,
        originalLinesCount: 85,
      },
      selectedTier: "tier1_fast",
      tokenCount: 2200,
      timestamp: "16:45:18",
    },
  ]);

  const sampleDiff = `--- a/src/lib/auth.ts
+++ b/src/lib/auth.ts
@@ -42,7 +42,9 @@ export function validateRedirect(url: string): boolean {
-  return url.startsWith("https://") || url.startsWith("/");
+  const parsed = new URL(url, "https://internal.host");
+  const isRelative = url.startsWith("/") && !url.startsWith("//");
+  return isRelative || parsed.protocol === "https:";
 }`;

  const handleLaunchTask = () => {
    setIsRunning(true);
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Dispatched task to Temporal Durable Workflow`,
    ]);
  };

  return (
    <main className="min-h-screen p-6 md:p-10">
      <header className="mb-8 flex flex-col gap-2 border-b border-slate-800 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 font-black text-slate-950 text-lg shadow-lg shadow-sky-500/20">
              🦅
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">
                Hermes-Clawdbot Control Center
              </h1>
              <p className="text-xs text-slate-400">
                Bridging OpenClaw Multi-Platform Gateway & Nous Research Self-Evolution with MicroVM Isolation & Temporal Durability
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-400">
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            Gateway: ws://127.0.0.1:18789
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Temporal: Healthy
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-400">
            MicroVM: E2B / Firecracker
          </span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("LIVE")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === "LIVE"
              ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20"
              : "text-slate-400 hover:bg-slate-900 hover:text-white"
          }`}
        >
          🚀 Live Execution & MicroVM Sandbox
        </button>
        <button
          onClick={() => setActiveTab("MEMORY")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === "MEMORY"
              ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20"
              : "text-slate-400 hover:bg-slate-900 hover:text-white"
          }`}
        >
          🧠 4-Tier Memory (OpenClaw / Hermes)
        </button>
        <button
          onClick={() => setActiveTab("SKILLS")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === "SKILLS"
              ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20"
              : "text-slate-400 hover:bg-slate-900 hover:text-white"
          }`}
        >
          ✨ L4 Skills & Learning Loop
        </button>
        <button
          onClick={() => setActiveTab("COMPARISON")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === "COMPARISON"
              ? "bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20"
              : "text-slate-400 hover:bg-slate-900 hover:text-white"
          }`}
        >
          📊 Architecture & Competitive Comparison
        </button>
      </div>

      {activeTab === "LIVE" && (
        <>
          {/* Task Launcher Bar */}
          <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50 p-5 shadow-xl">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Dispatch Autonomous Engineering Task
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="text-[11px] text-slate-400">Issue / Prompt</label>
                <input
                  type="text"
                  value={taskPrompt}
                  onChange={(e) => setTaskPrompt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Repository URL</label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleLaunchTask}
                  disabled={isRunning}
                  className="w-full rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
                >
                  {isRunning ? "Executing in MicroVM..." : "Launch Agent Workflow"}
                </button>
              </div>
            </div>
          </section>

          {/* Main Grid: Live Terminal, Budget, Trajectory, Diff */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Column (2 cols): Terminal & Steps */}
            <div className="space-y-6 lg:col-span-2">
              <TerminalStream logs={logs} />
              <StepTimeline steps={steps} />
            </div>

            {/* Right Column: Gauges and Diff */}
            <div className="space-y-6">
              <TokenBudgetGauge currentTokens={46500} maxTokens={200000} costUsd={0.342} />
              <DiffViewer diffText={sampleDiff} />

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Multi-Platform Gateway Channels
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-slate-800 bg-slate-950 p-2 text-center text-slate-300">
                    Slack (@slack/bolt)
                    <div className="text-[10px] text-emerald-400 font-mono mt-0.5">● Connected</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950 p-2 text-center text-slate-300">
                    Discord (discord.js)
                    <div className="text-[10px] text-emerald-400 font-mono mt-0.5">● Connected</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950 p-2 text-center text-slate-300">
                    Telegram (grammY)
                    <div className="text-[10px] text-emerald-400 font-mono mt-0.5">● Connected</div>
                  </div>
                  <div className="rounded border border-slate-800 bg-slate-950 p-2 text-center text-slate-300">
                    WhatsApp Webhook
                    <div className="text-[10px] text-emerald-400 font-mono mt-0.5">● Ready</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "MEMORY" && <MemoryInspector />}

      {activeTab === "SKILLS" && <SkillsCatalogView />}

      {activeTab === "COMPARISON" && <ArchitectureComparison />}
    </main>
  );
}
