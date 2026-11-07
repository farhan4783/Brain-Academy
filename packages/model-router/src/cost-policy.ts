export interface PolicyViolation {
  blocked: boolean;
  reason?: string;
}

export class CostAndSafetyPolicy {
  private maxTokensPerTask: number;
  private maxTaskCostUsd: number;
  private blockedPatterns: RegExp[];

  constructor(options?: { maxTokens?: number; maxCostUsd?: number }) {
    this.maxTokensPerTask = options?.maxTokens ?? 500000;
    this.maxTaskCostUsd = options?.maxCostUsd ?? 5.0;
    this.blockedPatterns = [
      /rm\s+-rf\s+\/($|\s)/, // Prevent rm -rf /
      /curl.*\|.*bash/i,     // Prevent untrusted pipe-to-bash
      /:(){ :\|:& };:/,      // Fork bomb prevention
      /mkfs\./,              // Filesystem wipe attempts
      /chmod\s+-R\s+777\s+\//,
    ];
  }

  public validateCommand(command: string): PolicyViolation {
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(command)) {
        return {
          blocked: true,
          reason: `Security Policy Violation: Command matches blocked malicious pattern '${pattern.source}'.`,
        };
      }
    }
    return { blocked: false };
  }

  public validateBudget(currentTokens: number, currentCostUsd: number): PolicyViolation {
    if (currentTokens > this.maxTokensPerTask) {
      return {
        blocked: true,
        reason: `Organization Policy: Token ceiling of ${this.maxTokensPerTask} tokens reached for this task.`,
      };
    }

    if (currentCostUsd > this.maxTaskCostUsd) {
      return {
        blocked: true,
        reason: `Organization Policy: Cost limit of $${this.maxTaskCostUsd.toFixed(2)} USD exceeded.`,
      };
    }

    return { blocked: false };
  }
}
