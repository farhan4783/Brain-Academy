"use client";

import React, { useState } from "react";

interface SkillItem {
  id: string;
  name: string;
  description: string;
  category: "Synthesized (Self-Evolution)" | "Built-in SOP";
  tags: string[];
  markdownPreview: string;
}

export const SkillsCatalogView: React.FC = () => {
  const [selectedSkill, setSelectedSkill] = useState<string>("workflow-auth-ssrf-remediation");

  const skills: SkillItem[] = [
    {
      id: "workflow-auth-ssrf-remediation",
      name: "workflow-auth-ssrf-remediation",
      description: "Autonomous SOP synthesized after resolving redirect URI SSRF vulnerabilities in auth handlers.",
      category: "Synthesized (Self-Evolution)",
      tags: ["security", "auth", "learning-loop"],
      markdownPreview: `---
name: workflow-auth-ssrf-remediation
description: Autonomous SOP synthesized after resolving redirect URI SSRF vulnerabilities.
tags: [security, auth, learning-loop]
---

# Workflow: Auth SSRF Remediation
Autonomously synthesized by Hermes Learning Loop.

## Execution Procedure:
1. Grep for \`new URL(\` or regex redirects in \`src/lib/auth\`.
2. Ensure relative paths verify \`!url.startsWith("//")\`.
3. Assert destination hostname matches configured domain whitelist.
4. Execute test suite: \`pnpm test tests/auth.test.ts\`.`,
    },
    {
      id: "git-patch-recovery",
      name: "git-patch-recovery",
      description: "Extracts minimal hunk diffs across multi-step edits without re-prompting entire files.",
      category: "Built-in SOP",
      tags: ["git", "context-compaction"],
      markdownPreview: `---
name: git-patch-recovery
description: Extracts minimal hunk diffs across multi-step edits.
tags: [git, context-compaction]
---

# Git Patch Recovery
Applies AST-level unified diffs into sandbox workspace.
1. Run \`git diff HEAD\` inside microVM.
2. Filter modified hunks and store in memory.
3. Replace raw file injections with diff hunks.`,
    },
    {
      id: "swe-bench-verification",
      name: "swe-bench-verification",
      description: "Spawns isolated verifier container, applies solution patch, and executes target test suite.",
      category: "Built-in SOP",
      tags: ["eval", "benchmarking", "testing"],
      markdownPreview: `---
name: swe-bench-verification
description: Spawns isolated verifier container and runs target tests.
tags: [eval, benchmarking, testing]
---

# SWE-Bench Verification
1. Clone target commit into fresh container.
2. Apply \`solution.patch\`.
3. Run test command (e.g. \`npm test\`).
4. Validate all expected unit tests pass.`,
    },
  ];

  const active = skills.find((s) => s.id === selectedSkill) || skills[0]!;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            Nous Research Learning Loop: L4 Procedural Skills
          </h3>
          <p className="text-xs text-slate-400">
            Progressive disclosure catalog. The agent retrieves full SKILL.md instructions only on demand.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Self-Evolution Active
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left Column: Skill List */}
        <div className="space-y-2">
          {skills.map((skill) => (
            <div
              key={skill.id}
              onClick={() => setSelectedSkill(skill.id)}
              className={`cursor-pointer rounded-lg border p-3 transition ${
                selectedSkill === skill.id
                  ? "border-sky-500 bg-sky-950/30"
                  : "border-slate-800 bg-slate-950 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-sky-400">{skill.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    skill.category.startsWith("Synthesized")
                      ? "bg-purple-950 text-purple-300 border border-purple-800"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {skill.category.startsWith("Synthesized") ? "Synthesized" : "Built-in"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{skill.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {skill.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-slate-900 px-1.5 py-0.2 text-[9px] text-slate-400 border border-slate-800"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right Column (2 cols): Skill Content Preview */}
        <div className="md:col-span-2 rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs">
          <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-slate-300">
              SKILL.md Inspector (File: <code className="text-amber-400">skills/{active.name}/SKILL.md</code>)
            </span>
            <span className="text-[10px] text-slate-500">Progressive Disclosure Spec</span>
          </div>
          <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap text-slate-300 leading-relaxed">
            {active.markdownPreview}
          </pre>
        </div>
      </div>
    </div>
  );
};
