import { Bot } from "grammy";
import { ChannelConnector, TaskDispatcherFn } from "./channel-registry.js";
import { TaskRequest } from "@hermes/shared";

export class TelegramChannelConnector implements ChannelConnector {
  public readonly name = "telegram";
  private bot: Bot | null = null;
  private token?: string;
  private dispatcher: TaskDispatcherFn;

  constructor(dispatcher: TaskDispatcherFn, token?: string) {
    this.dispatcher = dispatcher;
    this.token = token || process.env.TELEGRAM_BOT_TOKEN;
  }

  async start(): Promise<void> {
    if (!this.token) {
      console.log("[Gateway:Telegram] No TELEGRAM_BOT_TOKEN provided, skipping.");
      return;
    }

    this.bot = new Bot(this.token);

    this.bot.command("hermes", async (ctx) => {
      const prompt = ctx.match?.trim();
      if (!prompt) {
        await ctx.reply("Please provide a task prompt, e.g.: /hermes fix unit tests in repo");
        return;
      }

      const chatId = String(ctx.chat.id);
      const taskId = `tg_${chatId}_${Date.now()}`;
      await ctx.reply("🚀 Task received! Initializing isolated microVM sandbox via Temporal...");

      const request: TaskRequest = {
        taskId,
        prompt,
        platformMeta: {
          origin: "web", // fallback origin enum
          channelId: chatId,
          userId: String(ctx.from?.id || "tg_user"),
        },
      };

      try {
        const workflowId = await this.dispatcher(request);
        await ctx.reply(`⚙️ Workflow active: \`${workflowId}\`\nExecuting ReAct loop.`);
      } catch (err: unknown) {
        await ctx.reply(`❌ Failed to start task: ${(err as Error).message}`);
      }
    });

    this.bot.start().catch((err) => {
      console.error("[Gateway:Telegram] Bot polling error:", err);
    });
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stop();
    }
  }

  async sendMessage(
    target: { channelId: string; threadId?: string },
    text: string
  ): Promise<void> {
    if (this.bot) {
      await this.bot.api.sendMessage(target.channelId, text, { parse_mode: "Markdown" });
    }
  }
}

