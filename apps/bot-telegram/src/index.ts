import { Bot } from "grammy";
import { Connection, Client as TemporalClient } from "@temporalio/client";
import { hermesAgentWorkflow } from "@hermes/agent-core";
import { TaskRequest } from "@hermes/shared";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.log("No TELEGRAM_BOT_TOKEN set. Exiting Telegram Bot runner.");
  process.exit(0);
}

const bot = new Bot(token);

async function main() {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
  });
  const client = new TemporalClient({ connection });

  bot.command("start", async (ctx) => {
    await ctx.reply(
      "🦅 *Hermes-Clawdbot Agent Engine*\n\n" +
        "Autonomous developer agent with Firecracker microVM sandboxing & Temporal durability.\n\n" +
        "Use `/fix <issue description>` to dispatch an autonomous debugging run.",
      { parse_mode: "Markdown" }
    );
  });

  bot.command("fix", async (ctx) => {
    const prompt = ctx.match?.trim();
    if (!prompt) {
      await ctx.reply("Please specify what to fix, e.g.: `/fix resolve memory leak in websocket handler`", {
        parse_mode: "Markdown",
      });
      return;
    }

    const chatId = String(ctx.chat.id);
    const taskId = `tg_${chatId}_${Date.now()}`;
    await ctx.reply("🚀 Spawning ephemeral MicroVM sandbox (<500ms)... Temporal workflow registered.");

    const taskRequest: TaskRequest = {
      taskId,
      prompt,
      platformMeta: {
        origin: "web",
        channelId: chatId,
        userId: String(ctx.from?.id || "telegram_user"),
      },
    };

    try {
      const handle = await client.workflow.start(hermesAgentWorkflow, {
        taskQueue: process.env.TEMPORAL_TASK_QUEUE || "hermes-clawdbot-queue",
        workflowId: `tg-wf-${taskId}`,
        args: [taskRequest],
      });

      const result = await handle.result();
      await ctx.reply(
        `✅ *Task Solved!*\n` +
          `- Status: \`${result.status}\`\n` +
          `- Steps: \`${result.currentStep}\`\n` +
          `- Tokens: \`${result.totalTokensUsed}\`\n` +
          `- Cost: \`$${result.totalCostUsd.toFixed(4)}\``,
        { parse_mode: "Markdown" }
      );
    } catch (err: unknown) {
      await ctx.reply(`❌ *Task Failed:* ${(err as Error).message}`, { parse_mode: "Markdown" });
    }
  });

  bot.start();
  console.log("⚡️ Hermes Telegram bot is running!");
}

main().catch(console.error);
