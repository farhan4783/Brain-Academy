import { Connection, Client } from "@temporalio/client";
import { EvalCase, EvalResult, TaskRequest } from "@hermes/shared";
import { hermesAgentWorkflow } from "@hermes/agent-core";
import { createSandboxProvider } from "@hermes/sandbox";
import { MetricsCollector } from "./metrics-collector.js";

export class SWEBenchmarkRunner {
  private clientPromise: Promise<Client>;
  private metrics = new MetricsCollector();

  constructor() {
    this.clientPromise = (async () => {
      const connection = await Connection.connect({
        address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
      });
      return new Client({ connection });
    })();
  }

  public async runEvaluationCase(testCase: EvalCase): Promise<EvalResult> {
    const startTime = Date.now();
    const client = await this.clientPromise;
    const taskId = `eval_${testCase.id}_${Date.now()}`;

    const taskRequest: TaskRequest = {
      taskId,
      prompt: testCase.issueDescription,
      repoUrl: testCase.repoName.startsWith("http") ? testCase.repoName : `https://github.com/${testCase.repoName}.git`,
      repoBranch: testCase.repoCommit,
      platformMeta: {
        origin: "cli",
        userId: "eval-harness",
      },
      maxIterations: 20,
    };

    console.log(`\n======================================================`);
    console.log(`[SWE-BENCH] Starting Eval: ${testCase.id} on ${testCase.repoName}`);
    console.log(`Issue: ${testCase.issueDescription}`);
    console.log(`======================================================`);

    const handle = await client.workflow.start(hermesAgentWorkflow, {
      taskQueue: process.env.TEMPORAL_TASK_QUEUE || "hermes-clawdbot-queue",
      workflowId: `workflow-${taskId}`,
      args: [taskRequest],
    });

    const finalState = await handle.result();
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    // Verify solution by running test suite inside a fresh verification sandbox
    const sandboxProvider = createSandboxProvider();
    const verifierSandbox = await sandboxProvider.createSandbox(`verify_${taskId}`);

    let resolved = false;
    let testOutput = "";
    let patch = "";

    try {
      await verifierSandbox.mountRepository(taskRequest.repoUrl!, taskRequest.repoBranch);

      // Apply the agent's generated git patches
      patch = finalState.gitPatchAccumulator.join("\n") || "";
      if (patch.trim()) {
        await verifierSandbox.writeFile("/workspace/solution.patch", patch);
        await verifierSandbox.executeCommand("git apply /workspace/solution.patch", { cwd: "/workspace" });
      }

      // Execute target unit test command
      const testResult = await verifierSandbox.executeCommand(testCase.testCommand, {
        cwd: "/workspace",
        timeoutMs: 60000,
      });

      testOutput = `${testResult.stdout}\n${testResult.stderr}`;
      resolved = testResult.exitCode === 0;

      for (const expectedTest of testCase.expectedPassingTests) {
        if (!testOutput.includes(expectedTest)) {
          resolved = false;
          break;
        }
      }
    } finally {
      await verifierSandbox.destroy();
    }

    const evalResult: EvalResult = {
      evalId: testCase.id,
      taskId,
      resolved,
      durationSeconds,
      totalTokens: finalState.totalTokensUsed,
      costUsd: finalState.totalCostUsd,
      testOutput: testOutput.slice(-500),
      patchApplied: patch,
    };

    this.metrics.record(evalResult);
    console.log(`Result for ${testCase.id}: ${resolved ? "PASSED (Resolved)" : "FAILED"}`);
    return evalResult;
  }

  public getMetrics(): MetricsCollector {
    return this.metrics;
  }
}

