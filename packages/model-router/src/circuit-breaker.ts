export interface ProviderHealth {
  consecutiveFailures: number;
  lastFailureTime?: number;
  circuitOpen: boolean;
}

export class FailoverCircuitBreaker {
  private health: Map<string, ProviderHealth> = new Map();
  private maxConsecutiveFailures: number;
  private resetTimeoutMs: number;

  constructor(maxFailures = 3, resetTimeoutMs = 60000) {
    this.maxConsecutiveFailures = maxFailures;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  public isAvailable(providerName: string): boolean {
    const record = this.health.get(providerName);
    if (!record || !record.circuitOpen) return true;

    if (record.lastFailureTime && Date.now() - record.lastFailureTime > this.resetTimeoutMs) {
      // Half-open circuit test
      record.circuitOpen = false;
      record.consecutiveFailures = 0;
      return true;
    }

    return false;
  }

  public recordSuccess(providerName: string): void {
    const record = this.health.get(providerName) || {
      consecutiveFailures: 0,
      circuitOpen: false,
    };
    record.consecutiveFailures = 0;
    record.circuitOpen = false;
    this.health.set(providerName, record);
  }

  public recordFailure(providerName: string): void {
    const record = this.health.get(providerName) || {
      consecutiveFailures: 0,
      circuitOpen: false,
    };
    record.consecutiveFailures++;
    record.lastFailureTime = Date.now();

    if (record.consecutiveFailures >= this.maxConsecutiveFailures) {
      record.circuitOpen = true;
      console.warn(
        `[CircuitBreaker] Provider '${providerName}' tripped circuit after ${record.consecutiveFailures} failures. Failing over.`
      );
    }

    this.health.set(providerName, record);
  }
}

