# Hermes-Clawdbot: 16-Week Comprehensive Implementation Plan

## Executive Blueprint

Hermes-Clawdbot is an enterprise-grade autonomous software engineering execution engine engineered to solve the four fatal bottlenecks of modern LLM agents:
1. **Unsafe execution of arbitrary code** $\to$ Ephemeral microVM sandboxes (<500ms provision).
2. **Fragility over long-running workflows** $\to$ Temporal.io durable state replay and crash resilience.
3. **Context window degradation & high token costs** $\to$ AST-guided observation pruning and Git differential memory.
4. **Lack of empirical performance validation** $\to$ Automated SWE-bench style repository evaluations.

---

## 1. 16-Week Roadmap Overview

```
+-----------------------------------------------------------------------------------+
| WEEKS 1-4: Foundation & Sandboxing                                                |
| - Set up Firecracker/E2B microVM environment & terminal streaming via WebSocket. |
| - Build multi-platform gateway bridge (Slack, Discord, CLI, Web UI).              |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| WEEKS 5-8: Durable Execution & Temporal Loop                                      |
| - Wrap ReAct agent loops inside Temporal.io workflows.                            |
| - Test crash recovery by killing worker containers mid-task and verifying replay. |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| WEEKS 9-12: Context Compaction & Model Routing                                    |
| - Build AST observation pruner & Git patch differential memory.                   |
| - Implement context compaction engine to handle context windows > 200k.           |
| - Configure LiteLLM dynamic model routing based on task complexity.               |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| WEEKS 13-16: Benchmarking, UI & Research Paper                                    |
| - Build SWE-style eval benchmarks on real open-source repositories.               |
| - Finalize Next.js timeline UI with live terminal logs and code diff previews.    |
| - Write research manuscript and compile demo video.                               |
+-----------------------------------------------------------------------------------+
```

---

## 2. Phase-by-Phase Technical Specifications

### Phase 1: Foundation, Ephemeral MicroVMs & Gateway (Weeks 1–4)

#### Sprint 1 (Week 1): Monorepo Scaffold & Infrastructure
- **Deliverables**:
  - Turborepo + pnpm workspace configuration (`packages/*`, `apps/*`).
  - Docker Compose stack for local development (Temporal, PostgreSQL, Qdrant, LiteLLM proxy).
  - Environment validation and configuration schema using Zod.
- **Verification**: `pnpm build` passes across all packages; `docker compose up -d` brings up all 5 infrastructure services healthy within 30 seconds.

#### Sprint 2 (Week 2): MicroVM Sandboxing Core (`@hermes/sandbox`)
- **Deliverables**:
  - Define unified `SandboxInstance` and `SandboxProvider` TypeScript interfaces.
  - Integrate **E2B SDK** for instant cloud-isolated microVMs with sub-500ms provision times.
  - Implement **Firecracker MicroVM** driver for bare-metal Linux environments using `vsock` and REST API sockets.
  - Implement **Docker Sandbox** fallback for local offline development.
  - Workspace git mounting: shallow-clone user repositories into `/workspace` with isolated non-root user permissions.
- **Verification**: Benchmark test measuring sandbox creation and initialization latency consistently $\le 480\text{ ms}$.

#### Sprint 3 (Week 3): Terminal Multiplexing & WebSocket Streaming
- **Deliverables**:
  - Dual stream multiplexer separating `stdout` and `stderr`.
  - WebSocket event dispatcher streaming live bash execution output chunks.
  - Execution timeout guard (default 120s per shell command) to prevent infinite loops.
- **Verification**: Stream a live build command (e.g. `npm install`) and verify real-time reception of chunks via WebSocket without packet loss.

#### Sprint 4 (Week 4): Multi-Platform Gateway Bridge
- **Deliverables**:
  - **CLI Client (`@hermes/cli`)**: Commander.js CLI with commands: `hermes run "<prompt>" --repo <url>`.
  - **Slack Bot (`@hermes/bot-slack`)**: `@slack/bolt` bot listening to app mentions and thread replies.
  - **Discord Bot (`@hermes/bot-discord`)**: `discord.js` bot with `!hermes <prompt>` trigger.
  - **Web Dashboard Foundation (`@hermes/web`)**: Next.js 15 layout with Tailwind CSS.
- **Verification**: Dispatching a prompt from Slack, Discord, and CLI triggers a mock agent session and replies back into the respective platform channel.

---

### Phase 2: Durable Execution & Temporal State Machine (Weeks 5–8)

#### Sprint 5 (Week 5): Temporal Workflow Architecture (`@hermes/agent-core`)
- **Deliverables**:
  - Reconstruct the ReAct loop as `hermesAgentWorkflow(request: TaskRequest)`.
  - Define Temporal Activity interfaces:
    - `provisionSandboxActivity`: Provisions microVM, mounts repository.
    - `executeCommandActivity`: Runs tool execution with timeout.
    - `captureGitDiffActivity`: Retrieves workspace modifications.
    - `destroySandboxActivity`: Cleans up microVM on completion.
  - Activity retry policies with exponential backoff and jitter.
- **Verification**: Run a 10-step mock trajectory and verify that all steps are recorded deterministically in the Temporal Web UI event log.

#### Sprint 6 (Week 6): Worker Rehydration & Reconnection
- **Deliverables**:
  - Decouple sandbox lifecycles from worker process lifetimes.
  - Register active `sandboxId` in workflow state.
  - Implement `reconnectSandbox(sandboxId)` to allow recovering workers to reconnect to a running microVM without destroying or restarting it.
- **Verification**: Execute a long command inside the sandbox, send `kill -9` to the worker process, restart the worker, and verify the workflow resumes from the exact activity.

#### Sprint 7 (Week 7): Signal & Query Interactivity
- **Deliverables**:
  - Temporal Signals:
    - `cancelTaskSignal`: Gracefully cancels task, snapshots sandbox, and cleans up.
    - `provideFeedbackSignal`: Injects user guidance directly into the active ReAct loop mid-run.
  - Temporal Queries:
    - `getAgentStateQuery`: Real-time query of current step, accumulated tokens, active diffs, and execution status.
- **Verification**: Send a user clarification signal mid-run and verify the LLM's next thought incorporates the user input.

#### Sprint 8 (Week 8): Fault Tolerance & Crash Recovery Testing
- **Deliverables**:
  - Automated Chaos Test: A test script that repeatedly sends `SIGKILL` to worker nodes at steps 3, 7, and 12 of an issue resolution run.
  - Snapshot persistence: MicroVM state snapshots (`snapshotSandboxActivity`) on critical checkpoints.
- **Verification**: 100% of interrupted workflows successfully rehydrate state and complete execution upon worker restart.

---

### Phase 3: Context Compaction & Dynamic Model Routing (Weeks 9–12)

#### Sprint 9 (Week 9): AST-Guided Observation Truncator (`@hermes/context-engine`)
- **Deliverables**:
  - Terminal log filter for outputs exceeding 50 lines.
  - Stack trace preservation engine: parses python tracebacks, Node.js stack traces, compiler errors, and failed test assertions.
  - Truncates repetitive build/lint noise while preserving critical diagnostic context.
- **Verification**: Pass a 1,000-line failed Jest run through `ObservationTruncator.truncate()` and verify output is trimmed to $\le 50$ lines with exact failure stack trace retained.

#### Sprint 10 (Week 10): Git Patch Differential Memory
- **Deliverables**:
  - `GitPatchMemory`: Replaces repeated ingestion of entire modified source files with minimal unified Git diff patches (`git diff HEAD`).
  - Hunk parsing and modification tracking per file.
  - Integration into workflow context prompt.
- **Verification**: Measure token savings across a 15-step editing task; verify $\ge 40\%$ token reduction compared to full-file re-prompting.

#### Sprint 11 (Week 11): 75% Capacity Context Compactor
- **Deliverables**:
  - `TokenBudgeter`: Real-time token counter tracking context capacity.
  - 75% threshold detector: Triggers hierarchical compaction when context size $\ge 75\%$ of maximum window (e.g. 150k / 200k tokens).
  - `ContextCompactor`: Compresses historical steps $1 \dots t-3$ into structured key discoveries and attempted hypotheses, while preserving steps $t-2 \dots t$ verbatim.
- **Verification**: Simulate a 50-step trajectory reaching 200k tokens; verify compaction successfully compresses context back down to $\approx 40\%$ window capacity without losing active code patches.

#### Sprint 12 (Week 12): Dynamic Model Routing & Cost Policy (`@hermes/model-router`)
- **Deliverables**:
  - `TaskComplexityClassifier`:
    - **Tier 1 (Fast/Lightweight)**: Claude 3.5 Haiku / Llama-3-8B for file reads, directory navigation, formatting, and routine bash commands.
    - **Tier 2 (Deep Reasoning)**: Claude 3.5 Sonnet / DeepSeek-R1 for initial strategy planning, bug diagnosis, and post-error recovery.
  - Cost and security policy: Max token ceiling (500k), max cost ceiling ($5.00), and regex filters for dangerous shell commands (`rm -rf /`, fork bombs, etc.).
- **Verification**: Validate that file read tasks are dispatched to Haiku while complex syntax errors automatically escalate to Sonnet/DeepSeek.

---

### Phase 4: Benchmarking, Web Dashboard & Research Paper (Weeks 13–16)

#### Sprint 13 (Week 13): SWE-Bench Style Evaluation Harness (`@hermes/eval-suite`)
- **Deliverables**:
  - Automated benchmark harness loaded with real GitHub issues (e.g. `dubinc/dub`, `expressjs/cors`, `chalk`).
  - Isolated verification sandbox: mounts repo, applies agent's git patch, runs unit tests, and verifies pass/fail.
  - `MetricsCollector`: Gathers pass rate, duration, tokens consumed, and monetary cost.
- **Verification**: Run `pnpm eval` and generate an automated report across 3 benchmark cases.

#### Sprint 14 (Week 14): Full-Featured Next.js 15 Web Dashboard (`@hermes/web`)
- **Deliverables**:
  - Live Xterm.js terminal emulator streaming microVM output in real-time.
  - Step timeline visualizing agent thoughts, selected model tier, tool calls, and observations.
  - Side-by-side Git diff viewer with syntax highlighting.
  - Token budget gauge with dynamic 75% compaction indicator.
- **Verification**: Launch task from web UI; observe live terminal output and step updates in under 200ms latency.

#### Sprint 15 (Week 15): Long-Term Memory (Qdrant) & Optimization
- **Deliverables**:
  - Qdrant vector memory store for semantic codebase search and past issue solution retrieval.
  - End-to-end load testing and memory leak audits.
- **Verification**: Store a solution vector, perform similarity search, and verify relevant context injection into new tasks.

#### Sprint 16 (Week 16): Research Manuscript, Documentation & Final Presentation
- **Deliverables**:
  - Finalize research manuscript: *"Durable Multi-Platform Agent Execution with MicroVM Sandboxing and AST-Guided Context Compaction"*.
  - Compile empirical benchmark tables comparing vanilla ReAct vs. Hermes-Clawdbot.
  - Produce high-definition 3-minute capstone video demonstration showing Slack/Discord/Web coordination and crash recovery.
- **Verification**: Full project artifacts packaged, tested, and pushed to `https://github.com/farhan4783/Brain-Academy.git`.

---

## 3. Risk Matrix & Mitigation Strategies

| Risk | Impact | Probability | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Firecracker KVM requires bare-metal Linux** | High | High (on Windows) | Implemented 3-tier sandbox fallback: E2B cloud microVMs $\to$ Firecracker KVM $\to$ Local Docker containers. |
| **Worker process crash midway through task** | High | Medium | Temporal.io event log rehydration resumes from the exact activity step with zero state loss. |
| **Context window blowup on verbose test runs** | High | High | `ObservationTruncator` strictly caps output to 50 lines, isolating stack traces and trimming noise. |
| **Runaway LLM API costs** | Medium | Medium | Hard budget caps ($5.00/task), token ceiling (500k), and Tier 1 model routing for routine operations. |
| **Malicious or destructive bash commands** | Critical | Low | Sandboxed execution in non-root microVMs plus proactive command pattern blocking in `CostAndSafetyPolicy`. |

---

## 4. Key Milestones & Acceptance Criteria

1. **Milestone 1 (Week 4)**: Ephemeral sandbox boots in $<500\text{ ms}$; multi-platform gateway responds on CLI, Slack, and Discord.
2. **Milestone 2 (Week 8)**: Temporal workflow recovers seamlessly from simulated worker container crashes (`SIGKILL`).
3. **Milestone 3 (Week 12)**: AST truncation and Git differential memory demonstrate $\ge 40\%$ reduction in token expenditure.
4. **Milestone 4 (Week 16)**: SWE-bench style benchmark suite completes with verified test passes; research paper and demo video finalized.
