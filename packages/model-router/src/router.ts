import OpenAI from "openai";
import { ModelTier } from "@hermes/shared";
import { CostAndSafetyPolicy } from "./cost-policy.js";
import { PromptSecurityScanner } from "./prompt-security.js";
import { FailoverCircuitBreaker } from "./circuit-breaker.js";

export interface ModelCompletionResponse {
  content: string;
  tierUsed: ModelTier;
  modelIdentifier: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export class DynamicModelRouter {
  private client: OpenAI;
  private policy: CostAndSafetyPolicy;
  private circuitBreaker = new FailoverCircuitBreaker();

  private tierMap: Record<ModelTier, string> = {
    tier1_fast: process.env.MODEL_TIER1_FAST || "anthropic/claude-3-5-haiku-20241022",
    tier2_reasoning: process.env.MODEL_TIER2_REASONING || "anthropic/claude-3-5-sonnet-20241022",
    tier2_deep_reasoning: process.env.MODEL_TIER2_DEEP_REASONING || "deepseek/deepseek-r1",
  };

  private fallbackTierMap: Record<ModelTier, string> = {
    tier1_fast: "groq/llama-3.3-70b-versatile",
    tier2_reasoning: "deepseek/deepseek-r1",
    tier2_deep_reasoning: "anthropic/claude-3-5-sonnet-20241022",
  };

  constructor(policy?: CostAndSafetyPolicy) {
    this.policy = policy || new CostAndSafetyPolicy();
    this.client = new OpenAI({
      baseURL: process.env.LITELLM_PROXY_URL ? `${process.env.LITELLM_PROXY_URL}/v1` : undefined,
      apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || "sk-hermes-local",
    });
  }

  public async complete(
    systemPrompt: string,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    tier: ModelTier = "tier1_fast",
    totalTaskTokens = 0,
    totalTaskCost = 0
  ): Promise<ModelCompletionResponse> {
    const budgetCheck = this.policy.validateBudget(totalTaskTokens, totalTaskCost);
    if (budgetCheck.blocked) {
      throw new Error(budgetCheck.reason);
    }

    // Security scanning on latest user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      const scan = PromptSecurityScanner.scan(lastUserMsg.content);
      if (!scan.safe) {
        throw new Error(
          `Hermes Security Gateway Block: Suspicious prompt pattern detected (${scan.flags.join(", ")}) with threat level ${scan.threatLevel}.`
        );
      }
    }

    let targetModel = this.tierMap[tier];
    if (!this.circuitBreaker.isAvailable(targetModel)) {
      console.warn(`[Router] Primary model ${targetModel} unavailable. Failing over to ${this.fallbackTierMap[tier]}`);
      targetModel = this.fallbackTierMap[tier];
    }

    try {
      const response = await this.client.chat.completions.create({
        model: targetModel,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: tier === "tier1_fast" ? 0.2 : 0.4,
      });

      this.circuitBreaker.recordSuccess(targetModel);

      const choice = response.choices[0];
      const content = choice?.message?.content || "";
      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;

      // Exact pricing calculations
      let costUsd = 0;
      if (tier === "tier1_fast") {
        // Claude 3.5 Haiku: $0.80 input / $4.00 output per MTok
        costUsd = (promptTokens * 0.8 + completionTokens * 4.0) / 1_000_000;
      } else if (tier === "tier2_reasoning") {
        // Claude 3.5 Sonnet: $3.00 input / $15.00 output per MTok
        costUsd = (promptTokens * 3.0 + completionTokens * 15.0) / 1_000_000;
      } else {
        // DeepSeek-R1: $0.55 input / $2.19 output per MTok
        costUsd = (promptTokens * 0.55 + completionTokens * 2.19) / 1_000_000;
      }

      return {
        content,
        tierUsed: tier,
        modelIdentifier: targetModel,
        promptTokens,
        completionTokens,
        costUsd,
      };
    } catch (err: unknown) {
      this.circuitBreaker.recordFailure(targetModel);
      throw err;
    }
  }
}
