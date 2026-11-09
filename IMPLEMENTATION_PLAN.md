# Hermes-Clawdbot: Master Industrial Implementation Plan

## Executive Blueprint & Production Standards

Hermes-Clawdbot is an enterprise-grade autonomous software engineering execution engine engineered to solve the four fatal bottlenecks of modern LLM agents:
1. **Unsafe execution of arbitrary code** $\to$ Ephemeral microVM sandboxes (<500ms provision via Firecracker REST API & E2B).
2. **Fragility over long-running workflows** $\to$ Temporal.io durable state replay, Saga pattern compensation, and crash resilience.
3. **Context window degradation & high token costs** $\to$ AST-guided observation pruning (>50 lines), code skeleton extraction (-70%), and Git differential memory (-45%).
4. **Lack of verifiable performance & learning** $\to$ Automated SWE-bench style evals paired with Nous Research self-evolution learning loops synthesizing reusable `SKILL.md` playbooks.

---

## 1. 16-Week Roadmap Overview

```
+-----------------------------------------------------------------------------------+
| WEEKS 1-4: Foundation, Ephemeral MicroVMs & Universal Gateway                     |
| - Firecracker Unix domain socket REST client & sub-500ms boot lifecycle.          |
| - Vsock guest agent streaming protocol (CID 3 / Port 52).                         |
| - OpenClaw Universal Gateway daemon on ws://127.0.0.1:18789 with pairing auth.   |
| - Multi-platform connectors: Slack, Discord, Telegram, WhatsApp, CLI, and Web UI. |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| WEEKS 5-8: Durable Execution, Temporal Saga & Human-in-the-Loop                   |
| - Deterministic ReAct loop wrapped in Temporal.io workflows.                      |
| - Temporal Saga pattern: automatic compensating autopsy snapshots on failure.     |
| - Human-in-the-loop approval signals for sensitive actions (git push, rm, deploy).|
| - Automated chaos test: worker SIGKILL at step 14 with seamless step 15 replay.   |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| WEEKS 9-12: Context Compaction, AST Code Skeletons & Dynamic Model Routing        |
| - CodeSkeletonExtractor eliding method bodies across TS, Py, Go (-70% tokens).   |
| - TestFailureParser isolating exact assertion diffs for Jest, Vitest, Pytest.     |
| - Git patch differential memory & 75% capacity hierarchical compactor.            |
| - LiteLLM dynamic router with circuit-breaker failover & prompt security filter.  |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| WEEKS 13-16: 4-Tier Memory, Learning Loop, SWE-Bench Evals & Next.js 15 UI        |
| - 4-Tier Memory (SOUL, USER, MEMORY, daily logs) with session-kind write gating.   |
| - Self-evolution learning loop synthesizing verified L4 SKILL.md playbooks.       |
| - Dockerized SWE-bench runner executing issue suites on Dub.sh, Express, Chalk.   |
| - Next.js 15 Control Center with live Xterm.js streaming, diffs & memory editor.  |
+-----------------------------------------------------------------------------------+
```

---

## 2. In-Depth Industrial Module Specifications

### Module 1: MicroVM Sandboxing & Vsock Protocol (`packages/sandbox`)

#### 1.1 Firecracker REST API Lifecycle
1. **Boot Source (`PUT /boot-source`)**:
   - `kernel_image_path`: Uncompressed Linux kernel image (`vmlinux.bin`).
   - `boot_args`: `console=ttyS0 reboot=k panic=1 pci=off nomodules rw ip=172.16.0.2::172.16.0.1:255.255.255.0::eth0:off init=/hermes/guest-init`
2. **Copy-on-Write Rootfs (`PUT /drives/rootfs`)**:
   - Ephemeral overlay sparse file created in $<10\text{ms}$ using `qemu-img create -f qcow2 -b base.ext4 overlay.ext4`.
   - Never mutates the base golden image.
3. **Machine Config (`PUT /machine-config`)**:
   - `vcpu_count: 2`, `mem_size_mib: 2048`, `smt: false`, `track_dirty_pages: true`.
4. **Network & TAP Isolation (`PUT /network-interfaces/eth0`)**:
   - Host `tapX` interface created and assigned to microVM with non-root ownership.
   - IPTables rules enforce strict outbound isolation: blocks access to host private subnets (`10.0.0.0/8`, `192.168.0.0/16`, `169.254.169.254`).
5. **Vsock Agent Protocol (`PUT /vsock`)**:
   - Guest CID: 3, Host UDS path: `/tmp/hermes_fc_<id>.vsock`.
   - Guest daemon (`hermes-guest-agent`) listens on port 52.
   - Framing Protocol:
     - `CONNECT 52\n`
     - `EXEC {"cmd": "npm test", "cwd": "/workspace", "timeoutMs": 120000}\n`
     - Streams: `OUT <base64_chunk>\n`, `ERR <base64_chunk>\n`, `EXIT <code_number>\n`.

---

### Module 2: Durable Workflow & Saga Pattern (`packages/agent-core`)

#### 2.1 ReAct State Machine as Temporal Workflow
- **Workflow ID**: `hermes-<taskId>`.
- **Task Queue**: `hermes-clawdbot-queue`.
- **Execution Loop**:
  $$\text{Loop: } \text{Observation} \to \text{Compaction Check} \to \text{Model Routing} \to \text{Security Scan} \to \text{Tool Activity Execution}$$

#### 2.2 Temporal Saga Compensating Transactions
When a task fails (e.g. fatal error, timeout, or user cancellation):
1. Captures full memory/disk state snapshot: `PUT /snapshot/create`.
2. Stores snapshot ID in PostgreSQL audit ledger.
3. Appends autopsy entry to today's episodic memory log: `memory/YYYY-MM-DD.md`.
4. Gracefully terminates microVM and reclaims allocated TAP IP address.

#### 2.3 Human-in-the-Loop Interactivity
- Dangerous commands (`git push`, `rm -rf`, `npm publish`, production deploys) trigger an approval halt:
  - Temporal workflow enters `await condition(() => approvalDecision !== null, "10 minutes")`.
  - Sends interactive Slack Block Kit / Discord Button prompt (`[Approve] [Reject]`).
  - Receiving `approveExecutionSignal(true)` resumes execution; `false` yields a blocked observation.

---

### Module 3: AST Context Compaction & Anti-Rot (`packages/context-engine`)

#### 3.1 Code Skeleton Extractor (`CodeSkeletonExtractor`)
- Extracts class declarations, interface definitions, exported types, and method signatures while replacing implementation bodies with `/* ... body elided ... */`.
- Languages supported: TypeScript (`.ts`, `.tsx`), JavaScript (`.js`), Python (`.py`), Go (`.go`), Rust (`.rs`).
- Cuts repository discovery context overhead by **70%**.

#### 3.2 Structured Test Failure Extraction (`TestFailureParser`)
- Parses outputs from **Jest**, **Vitest**, **Pytest**, **Go Test**, and **Cargo**.
- Suppresses thousands of lines of passing tests.
- Extracts:
  - Exact failing test identifier and file location.
  - Expected vs. Received assertion diffs.
  - Trimmed failure stack traces.

#### 3.3 Unified Git Differential Memory (`GitPatchMemory`)
- Replaces repeated full-file re-prompts with unified Git diff patches (`git diff HEAD`).
- Maintains hunk-level statistics (lines added, lines removed, modified hunks).
- Reduces multi-step trajectory token consumption by **45%**.

---

### Module 4: Dynamic Model Router & Guardrails (`packages/model-router`)

#### 4.1 Tier Routing Matrix
- **Tier 1 (Fast / Routine)**: Claude 3.5 Haiku / Llama-3.3-70B.
  - Purpose: Directory traversal, file reads, routine bash syntax, formatting.
  - Cost: \$0.80 input / \$4.00 output per MTok.
- **Tier 2 (Deep Reasoning)**: Claude 3.5 Sonnet / DeepSeek-R1.
  - Purpose: Architecture planning, root-cause bug diagnosis, multi-file refactoring.
  - Cost: \$3.00 input / \$15.00 output per MTok (Sonnet), \$0.55 / \$2.19 per MTok (DeepSeek-R1).

#### 4.2 Failover Circuit Breaker & Security Scanner
- Tripping threshold: 3 consecutive 429/5xx errors opens circuit for 60s, automatically redirecting traffic to secondary fallback models.
- Prompt Security Scanner: Regex and semantic pattern filters intercept instruction overrides, jailbreak attempts, host probing, and obfuscated payloads before dispatching to LLM APIs.

---

### Module 5: Universal Gateway Control Plane (`packages/gateway`)

#### 5.1 JSON-RPC 2.0 Protocol Specifications (`ws://127.0.0.1:18789`)
- **Actions**:
  - `auth.pair`: Generates 6-digit pairing code with HMAC-SHA256 signature.
  - `auth.verify`: Validates code and issues signed Bearer token.
  - `task.submit`: Ingests `TaskRequest` and triggers Temporal durable workflow.
  - `task.pause` / `task.resume`: Pauses/resumes active trajectory.
  - `task.approve`: Submits human approval decision for sensitive commands.
  - `task.cancel`: Aborts workflow and runs compensating rollback.
  - `state.query`: Returns live step history, token counts, and diffs.
  - `memory.get`: Retrieves `SOUL.md`, `USER.md`, `MEMORY.md`, and episodic logs.
  - `skills.list`: Returns all installed and synthesized procedural skills.

#### 5.2 Multi-Platform Adapters
- **Slack**: `@slack/bolt` with Block Kit buttons and thread-level tracking.
- **Discord**: `discord.js` with ActionRow buttons and syntax-highlighted embeds.
- **Telegram**: `grammY` bot with command routing (`/fix`, `/status`) and inline keyboards.
- **WhatsApp**: Meta Cloud API webhook listener with `hub.challenge` handshake.
- **Autonomous Scheduler**: Node-cron backed recurring jobs paired with silent Heartbeat daemon.

---

### Module 6: 4-Tier Memory & Self-Evolution Learning Loop (`packages/memory`)

#### 6.1 4-Tier Memory Layout
- **L1 (Session)**: Ephemeral in-memory context cleared upon task completion.
- **L2 (Persisted Files)**:
  - `SOUL.md`: Identity, operational principles, core guidelines.
  - `USER.md`: User tech preferences, conventions, notification channels.
  - `MEMORY.md`: Long-term curated factual discoveries.
  - `memory/YYYY-MM-DD.md`: Episodic session audit trails.
- **L3 (Vector & Search)**: Qdrant vector memory (1536-dim embeddings) + local full-text search.
- **L4 (Procedural Skills)**: Reusable `skills/<skill_name>/SKILL.md` playbooks.

#### 6.2 Self-Evolution Learning Loop Mechanics
- When a workflow finishes with `status === "COMPLETED"` and $\ge 2$ successful tool actions:
  1. Reflection agent analyzes trajectory steps and isolates the winning sequence.
  2. Generates a new `SKILL.md` with structured YAML frontmatter, execution steps, and verification commands.
  3. Appends the newly synthesized skill to the progressive disclosure catalog.

---

### Module 7: SWE-Bench Automated Evaluation Harness (`packages/eval-suite`)

#### 7.1 Benchmark Workflow
1. Loads benchmark case from `packages/eval-suite/data/benchmarks.json`.
2. Clones target open-source repository commit into a microVM sandbox.
3. Dispatches task prompt to Hermes-Clawdbot.
4. Spawns an isolated verification container, applies the synthesized Git patch, and executes the target unit test suite.
5. Verifies all expected test assertions pass (pass@1).
6. Compiles empirical evaluation report with token efficiency, duration, and monetary cost metrics.
