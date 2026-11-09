import cron from "node-cron";
import { TaskDispatcherFn } from "./channels/channel-registry.js";
import { TieredMemoryManager } from "@hermes/memory";
import { TaskRequest } from "@hermes/shared";

export interface ScheduledCronJob {
  id: string;
  expression: string;
  prompt: string;
  repoUrl?: string;
}

export class GatewayScheduler {
  private dispatcher: TaskDispatcherFn;
  private memory: TieredMemoryManager;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(dispatcher: TaskDispatcherFn, memory: TieredMemoryManager) {
    this.dispatcher = dispatcher;
    this.memory = memory;
  }

  /**
   * Registers a recurring Cron job (e.g. nightly test runs, security scans).
   */
  public registerCron(job: ScheduledCronJob): void {
    if (this.scheduledTasks.has(job.id)) {
      this.scheduledTasks.get(job.id)?.stop();
    }

    const task = cron.schedule(job.expression, async () => {
      console.log(`[Gateway:Scheduler] Triggering scheduled Cron job [${job.id}]: ${job.prompt}`);
      this.memory.logEpisodicMemory(job.id, `Triggered cron job: ${job.prompt}`, "cron");

      const taskRequest: TaskRequest = {
        taskId: `cron_${job.id}_${Date.now()}`,
        prompt: `[Automated Scheduled Cron]: ${job.prompt}`,
        repoUrl: job.repoUrl,
        platformMeta: {
          origin: "cli",
          userId: "gateway-cron-daemon",
        },
      };

      try {
        await this.dispatcher(taskRequest);
      } catch (err) {
        console.error(`[Gateway:Scheduler] Cron job [${job.id}] dispatch failed:`, err);
      }
    });

    this.scheduledTasks.set(job.id, task);
  }

  /**
   * Starts OpenClaw-style silent Heartbeat daemon.
   * Periodically wakes up the agent to check repository and system health.
   * Follows strict "don't disturb if nothing's happening" philosophy.
   */
  public startHeartbeat(intervalMs = 300000): void {
    if (this.heartbeatInterval) return;

    console.log(`[Gateway:Heartbeat] Starting silent heartbeat daemon (interval: ${intervalMs}ms)...`);
    this.heartbeatInterval = setInterval(async () => {
      // Silent health patrol
      const memUsage = process.memoryUsage();
      const heapMb = Math.round(memUsage.heapUsed / 1024 / 1024);

      // Only notify or log if anomaly detected or once per day
      if (heapMb > 1024) {
        console.warn(`[Gateway:Heartbeat] Memory pressure detected: ${heapMb}MB heap used.`);
        this.memory.logEpisodicMemory(
          "heartbeat_alert",
          `High memory alert: ${heapMb}MB heap allocated.`,
          "heartbeat"
        );
      }
    }, intervalMs);
  }

  public stopAll(): void {
    for (const task of this.scheduledTasks.values()) {
      task.stop();
    }
    this.scheduledTasks.clear();

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

