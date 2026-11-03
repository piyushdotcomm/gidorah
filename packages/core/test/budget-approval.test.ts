/**
 * Budget and approval edge coverage (NFR-12: core policy/approval/budget >= 80%).
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { BudgetService } from "../src/runtime.ts";
import { classifyToolCall } from "../../policy/src/approval.ts";
import { classifyRepo } from "../../policy/src/classify.ts";
import { analyzeShellCommand } from "../../policy/src/shell.ts";
import { DEFAULT_POLICY } from "../../policy/src/schema.ts";

function ws() {
  const root = mkdtempSync(join(tmpdir(), "gidorah-budget-"));
  mkdirSync(join(root, "src"), { recursive: true });
  const classification = classifyRepo(DEFAULT_POLICY, root);
  return { root, ctx: { policy: DEFAULT_POLICY, classification, cwd: root, workspaceRoot: root }, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("budget: precheck throws at the limit, record warns once and tracks the task cap", () => {
  const budget = new BudgetService(1, 0.5);
  budget.precheck();
  assert.equal(budget.record(0.2).warning, false);
  assert.equal(budget.record(0.61).warning, true);
  assert.equal(budget.record(0.01).warning, false);
  const exceeded = budget.record(0.3);
  assert.equal(exceeded.taskExceeded, true);
  const snapshot = budget.snapshot();
  assert.equal(snapshot.usedUsd > 1, true);
  assert.equal(snapshot.remainingUsd, 0);
  assert.throws(() => new BudgetService(0, 0).precheck(), /budget exhausted/i);
});

test("budget: zero soft threshold warns immediately and warning fires once per session", () => {
  const budget = new BudgetService(10, 0, 0);
  assert.equal(budget.record(0.01).warning, true);
  assert.equal(budget.record(0.01).warning, false);
  assert.equal(budget.snapshot().warnedAtSoftThreshold, true);
});

test("approval: shell read-only allowlist and network detection edge cases", () => {
  const { ctx, cleanup } = ws();
  try {
    assert.equal(classifyToolCall("bash", { command: "rg TODO src" }, ctx).verdict, "allow");
    assert.equal(classifyToolCall("bash", { command: "git log --oneline" }, ctx).verdict, "allow");
    assert.equal(classifyToolCall("bash", { command: "npm install left-pad" }, ctx).verdict, "ask");
    assert.equal(classifyToolCall("bash", { command: "echo hi > out.txt" }, ctx).verdict, "ask");
    const analysis = analyzeShellCommand("cat a | grep b && echo c");
    assert.equal(analysis.segments.length, 3);
    assert.equal(analysis.readOnly, true);
  } finally {
    cleanup();
  }
});

test("approval: protected paths and workspace reads", () => {
  const { root, ctx, cleanup } = ws();
  try {
    assert.equal(classifyToolCall("read", { path: ".aws/credentials" }, ctx).verdict, "deny");
    assert.equal(classifyToolCall("read", { path: join(root, "src", "a.ts") }, ctx).verdict, "allow");
    assert.equal(classifyToolCall("edit", { path: "src/a.ts", find: "a", replace: "b" }, ctx).verdict, "ask");
    assert.equal(classifyToolCall("list", {}, ctx).verdict, "allow");
  } finally {
    cleanup();
  }
});
