import { PlatformOrigin, TaskRequest } from "@hermes/shared";

export interface ChannelMessage {
  channelType: PlatformOrigin | "telegram" | "whatsapp";
  channelId: string;
  userId: string;
  threadId?: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelConnector {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(
    target: { channelId: string; threadId?: string },
    text: string
  ): Promise<void>;
}

export type TaskDispatcherFn = (request: TaskRequest) => Promise<string>; // returns workflowId

export class ChannelRegistry {
  private connectors: Map<string, ChannelConnector> = new Map();

  public register(connector: ChannelConnector): void {
    this.connectors.set(connector.name, connector);
  }

  public get(name: string): ChannelConnector | undefined {
    return this.connectors.get(name);
  }

  public async startAll(): Promise<void> {
    for (const [name, connector] of this.connectors.entries()) {
      try {
        await connector.start();
        console.log(`[Gateway] Channel connector started: ${name}`);
      } catch (err) {
        console.warn(`[Gateway] Failed to start channel ${name}:`, err);
      }
    }
  }

  public async stopAll(): Promise<void> {
    for (const connector of this.connectors.values()) {
      await connector.stop().catch(() => {});
    }
  }
}

