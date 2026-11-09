import pkg from "@slack/bolt";
const { App } = pkg;
import { Connection, Client } from "@temporalio/client";
import { hermesAgentWorkflow, approveExecutionSignal, cancelTaskSignal } from "@hermes/agent-core";
import { TaskRequest } from "@hermes/shared";

const app = new App({
  token: process.env.SLACK_BOT_TOKEN || "xoxb-placeholder",
  signingSecret: process.env.SLACK_SIGNING_SECRET || "placeholder",
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

async function main() {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
  });
  const temporalClient = new Client({ connection });

  // Listen for mentions in channels
  app.event("app_mention", async ({ event, say }) => {
    const threadTs = event.thread_ts || event.ts;
    const prompt = event.text.replace(/<@[^>]+>/g, "").trim();

    await say({
      text: `🤖 Hermes-Clawdbot received your task! Spawning ephemeral microVM sandbox (<500ms)...`,
      thread_ts: threadTs,
    });

    const taskId = `slack_${event.channel}_${threadTs.replace(".", "_")}`;
    const taskRequest: TaskRequest = {
      taskId,
      prompt,
      platformMeta: {
        origin: "slack",
        channelId: event.channel,
        userId: event.user,
        threadId: threadTs,
      },
    };

    try {
      const handle = await temporalClient.workflow.start(hermesAgentWorkflow, {
        taskQueue: process.env.TEMPORAL_TASK_QUEUE || "hermes-clawdbot-queue",
        workflowId: `slack-wf-${taskId}`,
        args: [taskRequest],
      });

      const result = await handle.result();
      await say({
        text: `✅ Task completed!\n*Status:* \`${result.status}\`\n*Steps Executed:* \`${result.currentStep}\`\n*Total Tokens:* \`${result.totalTokensUsed}\`\n*Cost:* \`$${result.totalCostUsd.toFixed(4)}\``,
        thread_ts: threadTs,
      });
    } catch (err: unknown) {
      await say({
        text: `❌ Task failed with error: ${(err as Error).message}`,
        thread_ts: threadTs,
      });
    }
  });

  // Handle interactive Slack button approvals
  app.action("hermes_approve_action", async ({ ack, body, respond }) => {
    await ack();
    const actionBody = body as { actions?: Array<{ value: string }> };
    const taskId = actionBody.actions?.[0]?.value;
    if (taskId) {
      const handle = temporalClient.workflow.getHandle(`slack-wf-${taskId}`);
      await handle.signal(approveExecutionSignal, true).catch(() => {});
      await respond("✅ Command execution approved by user.");
    }
  });

  app.action("hermes_reject_action", async ({ ack, body, respond }) => {
    await ack();
    const actionBody = body as { actions?: Array<{ value: string }> };
    const taskId = actionBody.actions?.[0]?.value;
    if (taskId) {
      const handle = temporalClient.workflow.getHandle(`slack-wf-${taskId}`);
      await handle.signal(approveExecutionSignal, false).catch(() => {});
      await respond("🛑 Command execution rejected by user.");
    }
  });

  const port = Number(process.env.PORT) || 3001;
  await app.start(port);
  console.log(`⚡️ Hermes Slack Bot adapter is running on port ${port}!`);
}

main().catch(console.error);
