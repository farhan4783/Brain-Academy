#!/usr/bin/env node
import { Command } from "commander";
import { Connection, Client } from "@temporalio/client";
import { hermesAgentWorkflow, getAgentStateQuery } from "@hermes/agent-core";
import { TaskRequest } from "@hermes/shared";

const program = new Command();

program
  .name("hermes")
  .description("Hermes-Clawdbot Autonomous Multi-Platform Developer Agent")
  .version("1.0.0");

program
  .command("run <prompt>")
  .description("Execute a task inside an ephemeral microVM sandbox")
  .option("-r, --repo <url>", "Git repository URL to mount")
  .option("-b, --branch <branch>", "Git branch name", "main")
  .option("-m, --max-steps <number>", "Maximum agent iteration steps", "25")
  .action(async (prompt: string, options) => {
    console.log(`\n======================================================`);
    console.log(`  Hermes-Clawdbot CLI: Dispatching Autonomous Task    `);
    console.log(`======================================================`);
    console.log(`Prompt: ${prompt}`);
    if (options.repo) console.log(`Repo:   ${options.repo} (${options.branch})`);

    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
    });
    const client = new Client({ connection });

    const taskId = `cli_task_${Date.now()}`;
    const taskRequest: TaskRequest = {
      taskId,
      prompt,
      repoUrl: options.repo,
      repoBranch: options.branch,
      platformMeta: {
        origin: "cli",
        userId: process.env.USER || "developer",
      },
      maxIterations: parseInt(options.maxSteps, 10),
    };

    const handle = await client.workflow.start(hermesAgentWorkflow, {
      taskQueue: process.env.TEMPORAL_TASK_QUEUE || "hermes-clawdbot-queue",
      workflowId: `hermes-${taskId}`,
      args: [taskRequest],
    });

    console.log(`Workflow initiated: ${handle.workflowId}`);
    console.log("Observing execution...\n");

    const interval = setInterval(async () => {
      try {
        const state = await handle.query(getAgentStateQuery);
        const lastStep = state.history[state.history.length - 1];
        if (lastStep) {
          console.log(
            `[Step ${lastStep.stepNumber} | ${lastStep.selectedTier}]: ${lastStep.thought.slice(0, 100)}...`
          );
        }
      } catch {
        // Query might fail if workflow completed
      }
    }, 2500);

    const result = await handle.result();
    clearInterval(interval);

    console.log(`\n======================================================`);
    console.log(`Task Finished with Status: ${result.status}`);
    console.log(`Total Steps Executed:     ${result.currentStep}`);
    console.log(`Total Tokens Used:        ${result.totalTokensUsed}`);
    console.log(`Total Cost:               $${result.totalCostUsd.toFixed(4)} USD`);
    if (result.errorMessage) {
      console.log(`Error:                    ${result.errorMessage}`);
    }
    console.log(`======================================================\n`);
  });

program.parse(process.argv);
