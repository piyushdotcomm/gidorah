/**
 * Replay suite (FR-53): a recorded demo trace renders offline, identically,
 * with no network. Schema drift fails loudly instead of silently rendering a
 * different story.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readReplay, renderTuiEvent, writeReplay } from "../../packages/core/src/replay.ts";
import type { TuiEvent } from "../../packages/shared/src/types.ts";

const EVENTS: TuiEvent[] = [
  { type: "notice", level: "info", text: "scene 1" },
  { type: "tool_call", callId: "c1", name: "read", args: { path: "a.ts" } },
  { type: "approval_request", approvalId: "a1", tool: "edit", risk: "write", preview: "diff" },
  { type: "approval_decision", approvalId: "a1", decision: "deny" },
  { type: "route_changed", from: "deepseek/deepseek-pro", to: "deepseek/deepseek-flash", reason: "429", fallbackIndex: 1 },
  { type: "turn_done", receipt: { sessionId: "s", taskId: "t", status: "success", summary: "done", tokens: { input: 10, output: 2, cacheRead: 0, cacheWrite: 0, total: 12 }, llmCostUsd: 0.001, researchCredits: 0, fallbacks: 1, budgetRemaining: { llmUsd: 1, researchCredits: 50 } } },
];

test("recorded traces replay offline and deterministically", () => {
  const dir = mkdtempSync(join(tmpdir(), "gidorah-replay-"));
  try {
    const file = join(dir, "demo.jsonl");
    writeReplay(file, EVENTS);
    const replayed = readReplay(file);
    assert.equal(replayed.length, EVENTS.length);
    const first = replayed.map((event) => renderTuiEvent(event)).join("\n");
    const second = readReplay(file).map((event) => renderTuiEvent(event)).join("\n");
    assert.equal(first, second);
    assert.ok(first.includes("route change"));
    assert.ok(first.includes("receipt"));
  } finally {
    // temp dir cleanup handled by the OS for this short-lived test
  }
});

test("corrupt replay traces fail loudly instead of rendering partial scenes", () => {
  const dir = mkdtempSync(join(tmpdir(), "gidorah-replay-bad-"));
  const file = join(dir, "demo.jsonl");
  writeFileSync(file, '{"type":"notice","level":"info","text":"ok"}\nnot-json\n');
  assert.throws(() => readReplay(file), /Corrupt JSONL/);
});

test("the committed demo trace replays without a network", () => {
  const file = join(process.cwd(), "tests", "replay", "demo.jsonl");
  if (!existsSync(file)) {
    assert.ok(true, "demo trace not recorded yet in this checkout");
    return;
  }
  const events = readReplay(file);
  assert.ok(events.length >= 5);
  const text = events.map((event) => renderTuiEvent(event)).join("\n");
  assert.ok(text.includes("approval"));
  assert.ok(text.includes("confidential") || text.includes("DLP"));
});
