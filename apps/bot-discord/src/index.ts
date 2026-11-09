import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { Connection, Client as TemporalClient } from "@temporalio/client";
import { hermesAgentWorkflow, approveExecutionSignal } from "@hermes/agent-core";
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

      const embed = new EmbedBuilder()
        .setColor(0x0ea5e9)
        .setTitle("🦅 Hermes-Clawdbot Autonomous Execution")
        .setDescription(`**Prompt:** ${prompt}\n\nSpawning Firecracker/E2B microVM (<500ms)...`)
        .setFooter({ text: "Temporal.io Durable Engine • OpenClaw Gateway" });

      const reply = await message.reply({ embeds: [embed] });

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

        const finishedEmbed = new EmbedBuilder()
          .setColor(state.status === "COMPLETED" ? 0x10b981 : 0xef4444)
          .setTitle(state.status === "COMPLETED" ? "✅ Task Successfully Solved" : "❌ Task Ended")
          .addFields(
            { name: "Status", value: `\`${state.status}\``, inline: true },
            { name: "Steps", value: `\`${state.currentStep}\``, inline: true },
            { name: "Total Tokens", value: `\`${state.totalTokensUsed.toLocaleString()}\``, inline: true },
            { name: "Total Cost", value: `\`$${state.totalCostUsd.toFixed(4)} USD\``, inline: true }
          );

        await reply.edit({ embeds: [finishedEmbed] });
      } catch (err: unknown) {
        await reply.edit({
          content: `❌ **Task Failed:** ${(err as Error).message}`,
          embeds: [],
        });
      }
    }
  });

  // Handle interactive Discord button approvals
  discordClient.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    const [action, taskId] = interaction.customId.split(":");
    if (!taskId) return;

    const handle = temporalClient.workflow.getHandle(`discord-wf-${taskId}`);

    if (action === "approve") {
      await handle.signal(approveExecutionSignal, true).catch(() => {});
      await interaction.reply({ content: "✅ Execution approved.", ephemeral: true });
    } else if (action === "reject") {
      await handle.signal(approveExecutionSignal, false).catch(() => {});
      await interaction.reply({ content: "🛑 Execution rejected.", ephemeral: true });
    }
  });

  if (process.env.DISCORD_BOT_TOKEN) {
    await discordClient.login(process.env.DISCORD_BOT_TOKEN);
  } else {
    console.log("No DISCORD_BOT_TOKEN provided, skipping Discord login.");
  }
}

main().catch(console.error);
