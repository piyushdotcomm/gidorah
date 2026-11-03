import assert from "node:assert/strict";
import { test } from "node:test";
import { TuiAdapter } from "../src/adapter.ts";
import type { TuiEvent } from "../../../packages/shared/src/types.ts";

function receipt(): TuiEvent {
  return {
    type: "turn_done",
    receipt: { sessionId: "s", taskId: "t", status: "success", summary: "done", tokens: { input: 10, output: 2, cacheRead: 0, cacheWrite: 0, total: 12 }, llmCostUsd: 0.001, researchCredits: 1, fallbacks: 1, budgetRemaining: { llmUsd: 1, researchCredits: 49 } },
  };
}

test("adapter projects the full event set into panels", () => {
  const adapter = new TuiAdapter({ mode: "confidential" });
  const events: TuiEvent[] = [
    { type: "assistant_delta", text: "working" },
    { type: "tool_call", callId: "c1", name: "read", args: { path: "a.ts" } },
    { type: "tool_result", callId: "c1", ok: true, summary: "read 10 lines" },
    { type: "approval_request", approvalId: "a1", tool: "edit", risk: "write", preview: "-1 +1" },
    { type: "approval_decision", approvalId: "a1", decision: "allow" },
    { type: "route_changed", from: "fireworks/strong", to: "fireworks/cheap", reason: "429", fallbackIndex: 1 },
    { type: "budget_updated", llmUsd: 0.42, llmLimit: 0.5, researchCredits: 2, researchLimit: 50 },
    {
      type: "research_card",
      card: { id: "card_1", question: "q", answer: "a", facts: ["f"], sources: [{ title: "docs", url: "https://docs.stripe.com/x", domain: "docs.stripe.com", retrievedAt: "2026-11-03" }], confidence: "high", tokenEstimate: 120, cached: false },
    },
    { type: "dlp_blocked", class: "aws-access-key", action: "blocked" },
    { type: "docs_check", result: "verified", symbols: ["constructEvent"] },
    { type: "notice", level: "warn", text: "budget warning" },
    receipt(),
  ];
  for (const event of events) adapter.apply(event);
  const rendered = adapter.render();
  assert.ok(rendered.includes("takeover"));
  assert.ok(rendered.includes("[research] high confidence"));
  assert.ok(rendered.includes("[dlp blocked] aws-access-key"));
  assert.ok(rendered.includes("[docs guard] verified: constructEvent"));
  assert.ok(rendered.includes("[receipt] success"));
  assert.ok(rendered.includes("approval"));
  assert.ok(rendered.includes("budget"));
  assert.equal(adapter.model.banners.length, 1);
  assert.equal(adapter.model.cards.length, 1);
  assert.equal(adapter.model.receipts.length, 1);
});

test("adapter clears the approval modal after a decision and keeps takeover durable", () => {
  const adapter = new TuiAdapter();
  adapter.apply({ type: "approval_request", approvalId: "a", tool: "bash", risk: "shell", preview: "rm -rf x" });
  assert.ok(adapter.model.approval !== null);
  assert.ok(adapter.render().includes("approval required"));
  adapter.apply({ type: "approval_decision", approvalId: "a", decision: "deny" });
  assert.equal(adapter.model.approval, null);
  adapter.apply({ type: "route_changed", from: "a", to: "b", reason: "503" });
  const first = adapter.render();
  const second = adapter.render();
  assert.equal(first, second);
  assert.ok(second.includes("a -> b"));
});

test("adapter renders a flight recorder table", () => {
  const adapter = new TuiAdapter();
  const table = adapter.renderTrace([
    {
      requestId: "r1", sessionId: "s", taskId: "t", phase: "explore",
      requested: { provider: "fireworks", model: "strong" }, served: { provider: "fireworks", model: "cheap" },
      fallback: true, fallbackIndex: 1, cacheHit: false,
      tokens: { input: 10, cacheRead: 0, cacheWrite: 0, output: 2, total: 12 }, costUsd: 0.0005, latencyMs: 10,
    },
  ]);
  assert.ok(table.includes("Phase"));
  assert.ok(table.includes("explore"));
  assert.ok(table.includes("yes #1"));
});
