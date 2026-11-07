import { EvalResult } from "@hermes/shared";

export interface AggregateBenchmarkMetrics {
  totalEvaluations: number;
  resolvedCount: number;
  resolutionRatePercent: string;
  averageDurationSeconds: number;
  totalTokensExpended: number;
  averageTokensPerTask: number;
  totalCostUsd: number;
  averageCostPerTaskUsd: number;
}

export class MetricsCollector {
  private results: EvalResult[] = [];

  public record(result: EvalResult): void {
    this.results.push(result);
  }

  public getResults(): EvalResult[] {
    return [...this.results];
  }

  public getAggregateMetrics(): AggregateBenchmarkMetrics {
    const total = this.results.length;
    if (total === 0) {
      return {
        totalEvaluations: 0,
        resolvedCount: 0,
        resolutionRatePercent: "0%",
        averageDurationSeconds: 0,
        totalTokensExpended: 0,
        averageTokensPerTask: 0,
        totalCostUsd: 0,
        averageCostPerTaskUsd: 0,
      };
    }

    const resolved = this.results.filter((r) => r.resolved).length;
    const totalDuration = this.results.reduce((acc, r) => acc + r.durationSeconds, 0);
    const totalTokens = this.results.reduce((acc, r) => acc + r.totalTokens, 0);
    const totalCost = this.results.reduce((acc, r) => acc + r.costUsd, 0);

    return {
      totalEvaluations: total,
      resolvedCount: resolved,
      resolutionRatePercent: `${((resolved / total) * 100).toFixed(1)}%`,
      averageDurationSeconds: Math.round(totalDuration / total),
      totalTokensExpended: totalTokens,
      averageTokensPerTask: Math.round(totalTokens / total),
      totalCostUsd: Number(totalCost.toFixed(4)),
      averageCostPerTaskUsd: Number((totalCost / total).toFixed(4)),
    };
  }
}

