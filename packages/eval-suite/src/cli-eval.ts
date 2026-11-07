import { SWEBenchmarkRunner } from "./benchmark-runner.js";
import { EvalCase } from "@hermes/shared";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const runner = new SWEBenchmarkRunner();
  const datasetPath =
    process.env.SWE_BENCH_DATASET_PATH ||
    path.join(process.cwd(), "data", "benchmarks.json");

  console.log(`Loading benchmark cases from ${datasetPath}...`);
  const rawData = fs.readFileSync(datasetPath, "utf-8");
  const testCases: EvalCase[] = JSON.parse(rawData);

  console.log(`Loaded ${testCases.length} benchmark test cases.`);

  for (const tc of testCases) {
    try {
      await runner.runEvaluationCase(tc);
    } catch (err) {
      console.error(`Evaluation failed for test case ${tc.id}:`, err);
    }
  }

  const aggregate = runner.getMetrics().getAggregateMetrics();
  console.log("\n=======================================================");
  console.log("            HERMES-CLAWDBOT EVALUATION REPORT          ");
  console.log("=======================================================");
  console.log(`Total Cases:              ${aggregate.totalEvaluations}`);
  console.log(`Resolved:                 ${aggregate.resolvedCount}`);
  console.log(`Pass Rate:                ${aggregate.resolutionRatePercent}`);
  console.log(`Avg Duration:             ${aggregate.averageDurationSeconds}s`);
  console.log(`Total Tokens:             ${aggregate.totalTokensExpended}`);
  console.log(`Total Cost:               $${aggregate.totalCostUsd} USD`);
  console.log(`Avg Cost/Task:            $${aggregate.averageCostPerTaskUsd} USD`);
  console.log("=======================================================\n");
}

main().catch(console.error);
