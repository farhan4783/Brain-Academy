import { ChannelConnector, TaskDispatcherFn } from "./channel-registry.js";
import { TaskRequest } from "@hermes/shared";

export class WhatsAppChannelConnector implements ChannelConnector {
  public readonly name = "whatsapp";
  private dispatcher: TaskDispatcherFn;
  private apiKey?: string;
  private phoneNumberId?: string;

  constructor(dispatcher: TaskDispatcherFn) {
    this.dispatcher = dispatcher;
    this.apiKey = process.env.WHATSAPP_API_KEY;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  }

  async start(): Promise<void> {
    if (!this.apiKey || !this.phoneNumberId) {
      console.log("[Gateway:WhatsApp] No WHATSAPP_API_KEY provided, skipping direct WhatsApp webhook listener.");
      return;
    }
    console.log("[Gateway:WhatsApp] WhatsApp connector ready.");
  }

  async handleInboundMessage(from: string, messageBody: string): Promise<void> {
    const taskId = `wa_${from}_${Date.now()}`;
    const request: TaskRequest = {
      taskId,
      prompt: messageBody,
      platformMeta: {
        origin: "web",
        channelId: from,
        userId: from,
      },
    };

    await this.dispatcher(request);
    await this.sendMessage({ channelId: from }, "🚀 Hermes-Clawdbot received your task! Spawning microVM sandbox...");
  }

  async stop(): Promise<void> {
    // Graceful teardown
  }

  async sendMessage(
    target: { channelId: string; threadId?: string },
    text: string
  ): Promise<void> {
    if (!this.apiKey || !this.phoneNumberId) return;

    try {
      await fetch(`https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: target.channelId,
          type: "text",
          text: { body: text },
        }),
      });
    } catch (err) {
      console.error("[Gateway:WhatsApp] Failed to send WhatsApp message:", err);
    }
  }
}

