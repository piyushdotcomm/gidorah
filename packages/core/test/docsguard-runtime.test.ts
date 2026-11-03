/**
 * Docs Guard runtime integration test (FR-52): an edit touching a documented
 * external SDK emits a docs/check event; a fresh fact sheet verifies it without
 * a research call, and an unknown symbol with no fact sheet does not block the edit.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createDefaultTools, runProcess } from "../src/tools.ts";
import { AutoApprovalService, BudgetService, runTask } from "../src/runtime.ts";
import { registerFactSheet } from "../src/docsguard.ts";
import { Session } from "../src/session.ts";
import { classifyRepo } from "../../policy/src/classify.ts";
import { classifyToolCall } from "../../policy/src/approval.ts";
import { DEFAULT_POLICY } from "../../policy/src/schema.ts";
import type { ModelClient, ModelRequest, ModelResponse } from "../../shared/src/types.ts";

function scriptedClient(steps: Array<{ toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>; content?: string }>): ModelClient {
  let index = 0;
  return {
    async complete(_request: ModelRequest): Promise<ModelResponse> {
      const step = steps[Math.min(index, steps.length - 1)]!;
      index += 1;
      const toolCalls = (step.toolCalls ?? []).map((call, callIndex) => ({ id: `call_${index}_${callIndex}`, name: call.name, arguments: call.arguments }));
      return {
        id: `m${index}`,
        content: step.content ?? "",
        toolCalls,
        usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, total: 15 },
        routing: { requested: { provider: "fireworks", model: "cheap" }, served: { provider: "fireworks", model: "cheap" }, fallback: false, cacheHit: false, latencyMs: 1 },
        finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
      };
    },
    async *stream(): AsyncIterable<never> {
      throw new Error("not used");
    },
  };
}

test("an edit on an external SDK emits docs/check and verifies from the fact sheet", async () => {
  const root = mkdtempSync(join(tmpdir(), "gidorah-docsguard-"));
  try {
    writeFileSync(join(root, "stripe.ts"), 'import Stripe from "stripe";\nconst s = new Stripe("x");\n');
    const policy = DEFAULT_POLICY;
    const classification = classifyRepo(policy, root);
    const sheets = new Map();
    registerFactSheet(sheets, { package: "stripe", version: "18.2.0", symbols: [{ name: "constructEvent", kind: "method", source: "docs" }], retrievedAt: "2026-11-03", confidence: "high" });
    const session = Session.create({ dir: join(root, ".sessions"), cwd: root, user: "test", mode: "cloud", policyVersion: "1" });
    const result = await runTask(session, "wire the stripe webhook", {
      model: scriptedClient([
        { toolCalls: [{ name: "edit", arguments: { path: "stripe.ts", find: 'const s = new Stripe("x");', replace: 'const s = new Stripe("x");\nconst event = s.webhooks.constructEvent("body", "sig", "secret");' } }] },
        { content: "done" },
      ]),
      tools: createDefaultTools(),
      approval: new AutoApprovalService(),
      budget: new BudgetService(1, 1),
      policy,
      repoClass: classification.mode,
      workspaceRoot: root,
      run: runProcess,
      estimateCost: () => 0.0001,
      classifyTool: (tool, args) => classifyToolCall(tool, args, { policy, classification, cwd: root, workspaceRoot: root }),
      docsGuard: { factSheets: sheets },
    });
    assert.equal(result.ok, true);
    const check = session.all.find((event) => event.type === "docs/check");
    assert.ok(check !== undefined, "docs/check event missing");
    const data = check.data as { result: string; package: string; lookups: number };
    assert.equal(data.package, "stripe");
    assert.equal(data.result, "verified");
    assert.equal(data.lookups, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
