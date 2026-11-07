import { NativeConnection, Worker } from "@temporalio/worker";
import * as sandboxActivities from "./activities/sandbox.activities.js";
import * as modelActivities from "./activities/model.activities.js";

export async function runWorker() {
  const temporalAddress = process.env.TEMPORAL_ADDRESS || "localhost:7233";
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE || "hermes-clawdbot-queue";

  console.log(`Connecting to Temporal server at ${temporalAddress}...`);
  const connection = await NativeConnection.connect({
    address: temporalAddress,
  });

  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || "default",
    taskQueue,
    workflowsPath: new URL("./workflows/hermes-agent.workflow.js", import.meta.url).pathname,
    activities: {
      ...sandboxActivities,
      ...modelActivities,
    },
    maxConcurrentActivityTaskExecutions: 10,
  });

  console.log(`Hermes-Clawdbot Temporal Worker started on queue [${taskQueue}]`);
  await worker.run();
}

if (process.argv[1]?.endsWith("worker.js")) {
  runWorker().catch((err) => {
    console.error("Worker process encountered fatal error:", err);
    process.exit(1);
  });
}
