# Hermes-Clawdbot System Architecture & Technical Topology

## 1. System Overview

**Hermes-Clawdbot** is an enterprise-grade autonomous software engineering execution engine. It bridges the multi-channel gateway & file-based memory of **OpenClaw (formerly Clawdbot by Peter Steinberger)** with the self-improving **learning loop of Nous Research's Hermes Agent**, while solving their fatal security and durability flaws using **Firecracker/E2B microVM isolation** and **Temporal.io durable workflow event sourcing**.

```mermaid
flowchart TD
    subgraph MultiPlatformGateway ["Universal Gateway Control Plane (ws://127.0.0.1:18789)"]
        SLACK["Slack Bot (@slack/bolt)"]
        DISCORD["Discord Bot (discord.js)"]
        TELEGRAM["Telegram Bot (grammY)"]
        WHATSAPP["WhatsApp Cloud API Webhook"]
        CLI["Developer CLI Client"]
        WEB["Next.js 15 Web Dashboard"]
        PAIRING["Device Pairing Protocol (6-Digit HMAC)"]
        SCHEDULER["Autonomous Cron & Heartbeat Daemon"]
    end

    subgraph TemporalEngine ["Durable Orchestration (Temporal.io)"]
        WF["HermesAgentWorkflow (Durable ReAct Loop)"]
        QUEUE["Task Queue & Event Sourcing Audit Log"]
        REPLAY["Step-Level State Replay & Rehydration"]
        SAGA["Temporal Saga Compensating Autopsy"]
        HITL["Human-in-the-Loop Approval Waiter"]
    end

    subgraph MemoryLayer ["4-Tier Memory & Learning Loop (OpenClaw + Hermes)"]
        SOUL["L1/L2: SOUL.md & USER.md"]
        FACTS["L2: MEMORY.md & Daily Logs"]
        QDRANT["L3: Semantic Vector Memory (Qdrant)"]
        SKILLS["L4: Procedural Skills (SKILL.md)"]
        LOOP["Self-Evolution Learning Loop (Auto-Synthesis)"]
    end

    subgraph ContextEngine ["Context Engineering & Anti-Rot Engine"]
        BUDGET["Token Budget & Capacity Tracker (75%)"]
        AST_PRUNE["AST Truncator (>50 lines stack trace preservation)"]
        SKELETON["CodeSkeletonExtractor (-70% repo context)"]
        PARSER["TestFailureParser (Jest, Pytest, Go, Cargo)"]
        GIT_DIFF["Git Patch Differential Memory (-45% tokens)"]
    end

    subgraph ModelRouter ["Dynamic Model Router Layer"]
        CLASSIFIER["Task Complexity Classifier"]
        TIER1["Tier 1: Fast/Small (Haiku / Llama 3)"]
        TIER2["Tier 2: Deep Reasoning (Sonnet 3.5 / DeepSeek-R1)"]
        BREAKER["Failover Circuit Breaker (Auto-Fallback)"]
        SCANNER["Prompt Security Scanner (Injection Blocker)"]
    end

    subgraph SandboxLayer ["Sandbox Orchestration Layer"]
        FC["Firecracker MicroVMs (<500ms REST boot)"]
        VSOCK["Vsock Guest Agent Protocol (CID 3 / Port 52)"]
        E2B["E2B SDK Cloud Clusters"]
        DOCKER["Local Docker Fallback"]
        STREAM["WebSocket PTY Terminal Streamer"]
    end

    SLACK -->|WebSocket / gRPC| WF
    DISCORD -->|WebSocket / gRPC| WF
    TELEGRAM -->|WebSocket / gRPC| WF
    WHATSAPP -->|WebSocket / gRPC| WF
    CLI -->|gRPC| WF
    WEB -->|WebSocket / gRPC| WF
    SCHEDULER -->|Trigger Job| WF

    WF <--> QUEUE
    WF <--> REPLAY
    WF <--> SAGA
    WF <--> HITL

    WF <--> MemoryLayer
    WF -->|Context Compaction & Extraction| ContextEngine
    WF -->|Infer Thought & Next Action| ModelRouter
    WF -->|Execute Command in MicroVM| SandboxLayer

    SandboxLayer -->|Live Terminal Stream| WEB
    WF -.->|On Task Success| LOOP
    LOOP -.->|Synthesize Playbook| SKILLS
```

---

## 2. Core Technical Modules & Deep Specifications

### Module A: Sub-500ms MicroVM Sandboxing (`packages/sandbox`)
- **Firecracker REST API Engine**:
  - Boot source configured via `PUT /boot-source` with uncompressed `vmlinux.bin`.
  - Ephemeral copy-on-write sparse file rootfs (`PUT /drives/rootfs`), ensuring zero mutation of base images and sub-10ms resets.
  - Vsock communication over CID 3 / Port 52 (`PUT /vsock`), multiplexing raw bash execution frames (`EXEC`, `OUT`, `ERR`, `EXIT`) with zero SSH daemon overhead.
- **Security & Cgroups V2 Isolation**:
  - Strict limits: 2 vCPUs, 2048 MB RAM, dropped Linux capabilities, network namespace TAP isolation with private subnet packet drop rules.
- **Post-Mortem Snapshots**:
  - Automatically captures microVM memory and disk snapshots (`PUT /snapshot/create`) upon task failure or crash for root-cause analysis.

### Module B: Durable Workflow Orchestration & Saga Pattern (`packages/agent-core`)
- **Deterministic Step-Level ReAct Loop**:
  - Models every cycle (`Thought -> Action -> Tool Call -> Observation`) as an immutable Temporal Activity.
  - If a worker node crashes at step 14, Temporal rehydrates the exact workflow history, reconnects to the active microVM sandbox via its ID, and resumes step 15 seamlessly without re-running prior activities or wasting LLM tokens.
- **Temporal Saga Pattern**:
  - Catches workflow failures and triggers `compensatingTransactionsActivity`: creates an autopsy disk snapshot, writes a post-mortem to episodic memory, and gracefully destroys the microVM.
- **Human-in-the-Loop Approval Gates**:
  - Sensitive operations (`git push`, `rm -rf`, production deployments) trigger an interactive approval halt.
  - The workflow suspends and waits for `approveExecutionSignal` from Slack / Discord / Web / CLI.

### Module C: Context Engineering & Anti-Rot Engine (`packages/context-engine`)
- **CodeSkeletonExtractor**:
  - Extracts structural syntax (classes, functions, interfaces, types) while eliding implementation details across TypeScript, JavaScript, Python, Go, and Rust. Reduces codebase scanning token footprint by **70%**.
- **TestFailureParser**:
  - Specialized parsers for Jest/Vitest, Pytest, Go test, and Cargo test that suppress passing tests and isolate exact assertion diffs (`Expected: ... Received: ...`) and failure stack traces.
- **Observation Truncator**:
  - Enforces a strict 50-line ceiling on all command outputs, stripping compiler noise while keeping diagnostic stack traces.
- **Git Patch Differential Memory**:
  - Maintains code changes as unified Git diff patches (`git diff HEAD`) rather than repeatedly feeding entire modified files into LLM context, saving **45%** on token overhead.
- **Qdrant Vector Memory**:
  - Long-term semantic code search over past resolutions and documentation using 1536-dimensional embeddings.

### Module D: Dynamic Model Routing & Cost Policy Layer (`packages/model-router`)
- **Task Classifier**:
  - **Tier 1 (Fast / Routine)**: Claude 3.5 Haiku / Llama-3.3-70B for file reads, directory inspection, syntax formatting, and routine bash scripts.
  - **Tier 2 (Deep Reasoning)**: Claude 3.5 Sonnet / DeepSeek-R1 for strategy planning, complex bug diagnosis, and multi-file refactoring.
- **Failover Circuit Breaker**:
  - Automatically redirects requests to secondary fallback providers upon detecting 3 consecutive rate-limit (429) or server overload (5xx) responses.
- **Prompt Security Scanner**:
  - Scans user prompts for instruction overrides, jailbreak attempts, host probing, and obfuscated payloads before dispatching to LLM APIs.

### Module E: OpenClaw Universal Gateway Control Plane (`packages/gateway`)
- **JSON-RPC 2.0 WebSocket Daemon (`ws://127.0.0.1:18789`)**:
  - Central control plane matching OpenClaw's standard protocol.
  - Exposes typed RPC methods: `task.submit`, `task.cancel`, `task.pause`, `task.resume`, `task.approve`, `state.query`, `memory.get`, `skills.list`.
- **Device Pairing Authentication**:
  - Implements 6-digit pairing code generation and HMAC-SHA256 signature verification for external nodes, mobile devices, and remote webhooks.
- **Multi-Platform Channel Adapters**:
  - Slack Bot (`@slack/bolt`) with Block Kit interactive approval buttons.
  - Discord Bot (`discord.js`) with ActionRow buttons and embeds.
  - Telegram Bot (`grammY`) with command routing and inline keyboards.
  - WhatsApp Cloud API webhook listener with `hub.challenge` handshake.
- **Autonomous Scheduler**:
  - Recurring Cron scheduler and silent Heartbeat daemon with anomaly gating to avoid notification spam.

### Module F: 4-Tier Memory & Self-Evolution Learning Loop (`packages/memory`)
- **File-Based Memory Hierarchy**:
  - `SOUL.md`: Agent core identity and operational directives.
  - `USER.md`: User preferences, active projects, tech stack conventions.
  - `MEMORY.md`: Long-term verified factual knowledge.
  - `memory/YYYY-MM-DD.md`: Daily episodic logs with session-kind write gating.
- **Nous Research Self-Evolution Learning Loop**:
  - Post-turn reflection activity (`HermesLearningLoop`) that analyzes completed trajectories and synthesizes reusable **`SKILL.md`** playbooks into the progressive disclosure catalog upon solving novel engineering tasks.

### Module G: SWE-Bench Evaluation Harness (`packages/eval-suite`)
- **Automated Verification Harness**:
  - Loads benchmark cases from real repositories (e.g. `dubinc/dub`, `expressjs/cors`, `chalk`).
  - Spawns an isolated verification container, applies the agent's synthesized patch, and runs target test suites.
  - Reports pass@1 resolution rate, mean time to resolution, token efficiency, and total cost.
