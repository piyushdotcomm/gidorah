import assert from "node:assert/strict";
import { test } from "node:test";
import { MODEL_PRICES, priceOf } from "../src/pricing.ts";

test("priceOf bills uncached input, cached input, and output separately", () => {
  const model = "accounts/fireworks/models/deepseek-v4p1-flash";
  const price = MODEL_PRICES[model]!;
  const cost = priceOf(model, { input: 1000, cacheRead: 400, output: 200 });
  assert.ok(cost !== undefined);
  const expected = 1000 * price.input + 400 * price.cachedInput + 200 * price.output;
  assert.ok(Math.abs(cost - expected) < 1e-12, `expected ${expected}, got ${cost}`);
});

test("priceOf returns undefined for unknown models and zero cache spend is not invented", () => {
  assert.equal(priceOf("unknown/model", { input: 1, cacheRead: 0, output: 1 }), undefined);
  const zero = priceOf("accounts/fireworks/models/deepseek-v4p1-flash", { input: 0, cacheRead: 0, output: 0 });
  assert.equal(zero, 0);
});
