import { WebSocketServer, WebSocket } from "ws";
import { Connection, Client as TemporalClient } from "@temporalio/client";
import {
  hermesAgentWorkflow,
  getAgentStateQuery,
  cancelTaskSignal,
  provideFeedbackSignal,
  pauseTaskSignal,
  resumeTaskSignal,
  approveExecutionSignal,
} from "@hermes/agent-core";
import { TaskRequest, AgentState } from "@hermes/shared";
import { TieredMemoryManager, SkillRegistry, HermesLearningLoop } from "@hermes/memory";
import { ChannelRegistry } from "./channels/channel-registry.js";
import { TelegramChannelConnector } from "./channels/telegram.channel.js";
import { WhatsAppChannelConnector } from "./channels/whatsapp.channel.js";
import { GatewayScheduler } from "./scheduler.js";
import { GatewayPairingAuth } from "./pairing-auth.js";

export class GatewayServer {
  private port: number;
  private wss: WebSocketServer | null = null;
  private temporalClientPromise: Promise<TemporalClient>;
  private memoryManager = new TieredMemoryManager();
  private skillRegistry = new SkillRegistry();
  private learningLoop = new HermesLearningLoop(this.skillRegistry);
  private channelRegistry = new ChannelRegistry();
  private scheduler: GatewayScheduler;
  private pairingAuth = new GatewayPairingAuth();
  private activeClients = new Set<WebSocket>();

  constructor(port = 18789) {
    this.port = port;
    this.temporalClientPromise = (async () => {
      const connection = await Connection.connect({
        address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
      });
      return new TemporalClient({ connection });
    })();

    const dispatcher = this.dispatchTask.bind(this);
    this.scheduler = new GatewayScheduler(dispatcher, this.memoryManager);

    // Register multi-platform channels
    this.channelRegistry.register(new TelegramChannelConnector(dispatcher));
    this.channelRegistry.register(new WhatsAppChannelConnector(dispatcher));
  }

  public async start(): Promise<void> {
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on("connection", (ws) => {
      this.activeClients.add(ws);
      console.log(`[Gateway] Client connected via WebSocket (active clients: ${this.activeClients.size})`);

      ws.on("message", async (data) => {
        try {
          const payload = JSON.parse(data.toString());
          await this.handleClientMessage(ws, payload);
        } catch (err) {
          ws.send(JSON.stringify({ error: (err as Error).message }));
        }
      });

      ws.on("close", () => {
        this.activeClients.delete(ws);
      });
    });

    await this.channelRegistry.startAll();
    this.scheduler.startHeartbeat(300000); // 5 min silent heartbeat

    console.log(`=======================================================`);
    console.log(`  🦅 Hermes-Clawdbot Gateway Running on port ${this.port} `);
    console.log(`  WebSocket Control Plane: ws://127.0.0.1:${this.port}`);
    console.log(`=======================================================`);
  }

  public async dispatchTask(request: TaskRequest): Promise<string> {
    const client = await this.temporalClientPromise;
    const taskQueue = process.env.TEMPORAL_TASK_QUEUE || "hermes-clawdbot-queue";
    const workflowId = `hermes-${request.taskId}`;

    console.log(`[Gateway] Dispatching task ${request.taskId} to Temporal queue [${taskQueue}]`);
    this.memoryManager.logEpisodicMemory(request.taskId, `User prompt: ${request.prompt}`);

    const handle = await client.workflow.start(hermesAgentWorkflow, {
      taskQueue,
      workflowId,
      args: [request],
    });

    // Background monitor to trigger Learning Loop upon task completion
    handle.result().then(async (finalState: AgentState) => {
      this.broadcast({
        type: "TASK_COMPLETED",
        taskId: request.taskId,
        state: finalState,
      });

      // Nous Research style Self-Evolution Learning Loop
      if (finalState.status === "COMPLETED") {
        const synthesized = await this.learningLoop.reflectAndSynthesize({
          taskPrompt: request.prompt,
          history: finalState.history,
          success: true,
        });

        if (synthesized) {
          console.log(`[LearningLoop] Synthesized new procedural skill: ${synthesized.skillName}`);
          this.broadcast({
            type: "SKILL_SYNTHESIZED",
            skill: synthesized,
          });
        }
      }
    }).catch((err) => {
      console.error(`[Gateway] Workflow execution failed for ${request.taskId}:`, err);
    });

    return workflowId;
  }

  private async handleClientMessage(
    ws: WebSocket,
    msg: { action: string; payload: Record<string, unknown> }
  ): Promise<void> {
    const client = await this.temporalClientPromise;

    switch (msg.action) {
      case "auth.pair": {
        const { clientId } = msg.payload as { clientId: string };
        const code = this.pairingAuth.generatePairingCode(clientId || "node");
        ws.send(JSON.stringify({ status: "PAIRING_CODE_GENERATED", code, expiresInSeconds: 300 }));
        break;
      }

      case "auth.verify": {
        const { code } = msg.payload as { code: string };
        const result = this.pairingAuth.verifyPairingCode(code);
        ws.send(JSON.stringify({ status: result.success ? "AUTHENTICATED" : "AUTH_FAILED", ...result }));
        break;
      }

      case "task.submit": {
        const req = msg.payload as unknown as TaskRequest;
        const workflowId = await this.dispatchTask(req);
        ws.send(JSON.stringify({ status: "DISPATCHED", workflowId, taskId: req.taskId }));
        break;
      }

      case "task.cancel": {
        const { taskId } = msg.payload as { taskId: string };
        const handle = client.workflow.getHandle(`hermes-${taskId}`);
        await handle.signal(cancelTaskSignal);
        ws.send(JSON.stringify({ status: "CANCELLING", taskId }));
        break;
      }

      case "task.pause": {
        const { taskId } = msg.payload as { taskId: string };
        const handle = client.workflow.getHandle(`hermes-${taskId}`);
        await handle.signal(pauseTaskSignal);
        ws.send(JSON.stringify({ status: "PAUSED", taskId }));
        break;
      }

      case "task.resume": {
        const { taskId } = msg.payload as { taskId: string };
        const handle = client.workflow.getHandle(`hermes-${taskId}`);
        await handle.signal(resumeTaskSignal);
        ws.send(JSON.stringify({ status: "RESUMED", taskId }));
        break;
      }

      case "task.approve": {
        const { taskId, approved } = msg.payload as { taskId: string; approved: boolean };
        const handle = client.workflow.getHandle(`hermes-${taskId}`);
        await handle.signal(approveExecutionSignal, approved);
        ws.send(JSON.stringify({ status: "APPROVAL_RECORDED", taskId, approved }));
        break;
      }

      case "task.feedback": {
        const { taskId, feedback } = msg.payload as { taskId: string; feedback: string };
        const handle = client.workflow.getHandle(`hermes-${taskId}`);
        await handle.signal(provideFeedbackSignal, feedback);
        ws.send(JSON.stringify({ status: "FEEDBACK_INJECTED", taskId }));
        break;
      }

      case "state.query": {
        const { taskId } = msg.payload as { taskId: string };
        const handle = client.workflow.getHandle(`hermes-${taskId}`);
        const state = await handle.query(getAgentStateQuery);
        ws.send(JSON.stringify({ status: "QUERY_RESULT", state }));
        break;
      }

      case "memory.get": {
        const memoryFiles = this.memoryManager.getWorkspaceFiles();
        ws.send(JSON.stringify({ status: "MEMORY_FILES", files: memoryFiles }));
        break;
      }

      case "skills.list": {
        const skills = this.skillRegistry.listSkills();
        ws.send(JSON.stringify({ status: "SKILLS_LIST", skills }));
        break;
      }

      default:
        ws.send(JSON.stringify({ error: `Unknown action: ${msg.action}` }));
    }
  }

  private broadcast(payload: unknown): void {
    const data = JSON.stringify(payload);
    for (const ws of this.activeClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  public async stop(): Promise<void> {
    this.scheduler.stopAll();
    await this.channelRegistry.stopAll();
    if (this.wss) {
      this.wss.close();
    }
  }
}

// Direct runner
if (process.argv[1]?.endsWith("gateway-server.js") || process.argv[1]?.endsWith("index.js")) {
  const port = Number(process.env.GATEWAY_PORT) || 18789;
  const server = new GatewayServer(port);
  server.start().catch((err) => {
    console.error("Fatal gateway server error:", err);
    process.exit(1);
  });
}
