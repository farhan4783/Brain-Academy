import { getEncoding } from "js-tiktoken";

export interface TokenBudgetConfig {
  maxWindowTokens: number;
  compactionThresholdRatio: number; // default 0.75 (75%)
  targetAfterCompactionRatio: number; // default 0.40 (40%)
}

export class TokenBudgeter {
  private config: TokenBudgetConfig;
  private tokenizer = getEncoding("cl100k_base");

  constructor(config?: Partial<TokenBudgetConfig>) {
    this.config = {
      maxWindowTokens: config?.maxWindowTokens ?? 200000,
      compactionThresholdRatio: config?.compactionThresholdRatio ?? 0.75,
      targetAfterCompactionRatio: config?.targetAfterCompactionRatio ?? 0.4,
    };
  }

  public countTokens(text: string): number {
    return this.tokenizer.encode(text).length;
  }

  public shouldCompact(currentTokens: number): boolean {
    const threshold = this.config.maxWindowTokens * this.config.compactionThresholdRatio;
    return currentTokens >= threshold;
  }

  public getCapacityUsage(currentTokens: number): {
    current: number;
    max: number;
    ratio: number;
    percentage: string;
    needsCompaction: boolean;
  } {
    const ratio = currentTokens / this.config.maxWindowTokens;
    return {
      current: currentTokens,
      max: this.config.maxWindowTokens,
      ratio,
      percentage: `${(ratio * 100).toFixed(1)}%`,
      needsCompaction: this.shouldCompact(currentTokens),
    };
  }
}

