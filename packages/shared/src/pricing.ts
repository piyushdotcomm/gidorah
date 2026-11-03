/**
 * Published model prices used for real-cost accounting (Standard serverless
 * rates, captured 2026-11-03 from https://fireworks.ai/pricing).
 *
 * Cost = usage x listed price. Cached input is billed separately; uncached
 * input is input minus cacheRead.
 */
export interface ModelPrice {
  input: number;
  cachedInput: number;
  output: number;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  "accounts/fireworks/models/deepseek-v4p1-flash": { input: 0.30e-6, cachedInput: 0.006e-6, output: 1.20e-6 },
  "accounts/fireworks/models/deepseek-v4p1-flash-1017": { input: 0.30e-6, cachedInput: 0.006e-6, output: 1.20e-6 },
  "accounts/fireworks/models/glm-5p3-flash": { input: 0.15e-6, cachedInput: 0.03e-6, output: 0.50e-6 },
  "accounts/fireworks/models/glm-5p3": { input: 1.40e-6, cachedInput: 0.26e-6, output: 4.40e-6 },
  "accounts/fireworks/models/qwen3p8-max": { input: 2.0e-6, cachedInput: 0.25e-6, output: 6.0e-6 },
  "accounts/fireworks/models/kimi-k3": { input: 3.0e-6, cachedInput: 0.30e-6, output: 15.0e-6 },
};

export function priceOf(model: string, usage: { input: number; cacheRead: number; output: number }): number | undefined {
  const price = MODEL_PRICES[model];
  if (price === undefined) return undefined;
  // TokenUsage.input is the uncached prompt-token count; cacheRead is separate.
  return usage.input * price.input + usage.cacheRead * price.cachedInput + usage.output * price.output;
}
