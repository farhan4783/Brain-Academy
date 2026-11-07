import OpenAI from "openai";
import { ModelTier } from "@hermes/shared";
import { CostAndSafetyPolicy } from "./cost-policy.js";

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

  private tierMap: Record<ModelTier, string> = {
    tier1_fast: process.env.MODEL_TIER1_FAST || "anthropic/claude-3-5-haiku-20241022",
    tier2_reasoning: process.env.MODEL_TIER2_REASONING || "anthropic/claude-3-5-sonnet-20241022",
    tier2_deep_reasoning: process.env.MODEL_TIER2_DEEP_REASONING || "deepseek/deepseek-r1",
  };

  constructor(policy?: CostAndSafetyPolicy) {
    this.policy = policy || new CostAndSafetyPolicy();
    // Connects to LiteLLM Proxy or direct OpenAI-compatible endpoint
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

    const targetModel = this.tierMap[tier];

    const response = await this.client.chat.completions.create({
      model: targetModel,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: tier === "tier1_fast" ? 0.2 : 0.4,
    });

    const choice = response.choices[0];
    const content = choice?.message?.content || "";
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;

    // Estimate cost based on tier
    const costUsd =
      tier === "tier1_fast"
        ? (promptTokens * 0.8 + completionTokens * 4.0) / 1_000_000
        : (promptTokens * 3.0 + completionTokens * 15.0) / 1_000_000;

    return {
      content,
      tierUsed: tier,
      modelIdentifier: targetModel,
      promptTokens,
      completionTokens,
      costUsd,
    };
  }
}

