import { Client, GatewayIntentBits } from "discord.js";
import { Connection, Client as TemporalClient } from "@temporalio/client";
import { hermesAgentWorkflow } from "@hermes/agent-core";
import { TaskRequest } from "@hermes/shared";

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

async function main() {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
  });
  const temporalClient = new TemporalClient({ connection });

  discordClient.on("ready", () => {
    console.log(`🤖 Discord bot logged in as ${discordClient.user?.tag}`);
  });

  discordClient.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith("!hermes ")) {
      const prompt = message.content.replace("!hermes ", "").trim();
      const reply = await message.reply("🚀 Dispatching task to Hermes-Clawdbot microVM cluster...");

      const taskId = `discord_${message.channelId}_${message.id}`;
      const taskRequest: TaskRequest = {
        taskId,
        prompt,
        platformMeta: {
          origin: "discord",
          channelId: message.channelId,
          userId: message.author.id,
        },
      };

      try {
        const handle = await temporalClient.workflow.start(hermesAgentWorkflow, {
          taskQueue: process.env.TEMPORAL_TASK_QUEUE || "hermes-clawdbot-queue",
          workflowId: `discord-wf-${taskId}`,
          args: [taskRequest],
        });

        const state = await handle.result();
        await reply.edit(
          `✅ **Task Completed!**\n- Status: \`${state.status}\`\n- Steps: \`${state.currentStep}\`\n- Tokens: \`${state.totalTokensUsed}\`\n- Cost: \`$${state.totalCostUsd.toFixed(4)}\``
        );
      } catch (err: unknown) {
        await reply.edit(`❌ **Task Failed:** ${(err as Error).message}`);
      }
    }
  });

  if (process.env.DISCORD_BOT_TOKEN) {
    await discordClient.login(process.env.DISCORD_BOT_TOKEN);
  } else {
    console.log("No DISCORD_BOT_TOKEN provided, skipping Discord login.");
  }
}

main().catch(console.error);

