import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ProviderError } from "../../../packages/shared/src/errors.ts";
import type { ModelClient, ModelResponse } from "../../../packages/shared/src/types.ts";
import type { Terminal } from "@earendil-works/pi-tui";
import { PiTuiApp } from "../src/pi-app.ts";
import { GidorahShell } from "../src/pi-shell.ts";
import { BudgetService } from "../../../packages/core/src/runtime.ts";
import { createDefaultTools, runProcess } from "../../../packages/core/src/tools.ts";
import { Session } from "../../../packages/core/src/session.ts";
import { classifyToolCall } from "../../../packages/policy/src/approval.ts";
import { classifyRepo } from "../../../packages/policy/src/classify.ts";
import { DEFAULT_POLICY } from "../../../packages/policy/src/schema.ts";

class FakeTerminal implements Terminal {
  columns = 100;
  rows = 32;
  kittyProtocolActive = false;
  writes: string[] = [];
  start(): void {}
  stop(): void {}
  async drainInput(): Promise<void> {}
  write(data: string): void {
    this.writes.push(data);
  }
  moveBy(): void {}
  hideCursor(): void {}
  showCursor(): void {}
  clearLine(): void {}
  clearFromCursor(): void {}
  clearScreen(): void {}
  setTitle(): void {}
  setProgress(): void {}
}

interface Step {
  content?: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  fail?: boolean;
}

function model(steps: Step[]): ModelClient {
  let index = 0;
  const build = (step: Step): ModelResponse => ({
    id: "fake",
    content: step.content ?? "",
    toolCalls: (step.toolCalls ?? []).map((call, i) => ({ id: `c${index}_${i}`, name: call.name, arguments: call.arguments })),
    usage: { input: 5, output: 3, cacheRead: 0, cacheWrite: 0, total: 8 },
    routing: { requested: { provider: "mock", model: "mock" }, served: { provider: "mock", model: "mock" }, fallback: false, cacheHit: false, latencyMs: 1 },
    finishReason: (step.toolCalls ?? []).length > 0 ? "tool_calls" : "stop",
  });
  return {
    async complete(): Promise<ModelResponse> {
      const step = steps[Math.min(index, steps.length - 1)]!;
      index += 1;
      if (step.fail === true) throw new ProviderError("provider exploded", { status: 500 });
      return build(step);
    },
    async *stream(): AsyncIterable<{ type: "delta"; text: string } | { type: "done"; response: ModelResponse }> {
      const step = steps[Math.min(index, steps.length - 1)]!;
      index += 1;
      if (step.fail === true) throw new ProviderError("provider exploded", { status: 500 });
      const final = build(step);
      for (const piece of (step.content ?? "").match(/[\s\S]{1,8}/g) ?? []) yield { type: "delta", text: piece };
      yield { type: "done", response: final };
    },
  };
}

function makeApp(steps: Step[]): { app: PiTuiApp; terminal: FakeTerminal; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "gidorah-pi-"));
  const session = Session.create({ dir: join(root, ".sessions"), cwd: root, user: "test", mode: "cloud", policyVersion: "1" });
  const policy = DEFAULT_POLICY;
  const classification = classifyRepo(policy, root);
  const budget = new BudgetService(1, 1);
  const terminal = new FakeTerminal();
  const app = new PiTuiApp({
    session,
    terminal,
    createDeps: (_target, hooks) => ({
      model: model(steps),
      tools: createDefaultTools(),
      approval: hooks.approval,
      budget,
      policy,
      repoClass: classification.mode,
      workspaceRoot: root,
      run: runProcess,
      estimateCost: () => 0.0001,
      classifyTool: (tool: string, args: Record<string, unknown>) => classifyToolCall(tool, args, { policy, classification, cwd: root, workspaceRoot: root }),
      ...(hooks.onModelDelta === undefined ? {} : { onModelDelta: hooks.onModelDelta }),
      ...(hooks.signal === undefined ? {} : { signal: hooks.signal }),
    }),
    createSession: () => Session.create({ dir: join(root, ".sessions"), cwd: root, user: "test", mode: "cloud", policyVersion: "1" }),
    loadSession: (id) => Session.load(join(root, ".sessions", id, "session.jsonl")),
    listSessions: () => [],
    budgetSnapshot: () => budget.snapshot(),
    cwd: root,
    branch: "test",
    mode: "mock",
    modelAlias: "gidorah-auto",
    width: 100,
    height: 32,
    historyFile: join(root, "history"),
  });
  return { app, terminal, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

async function waitFor(check: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`timeout: ${label}`);
}

test("pi TUI streams, shows one approval, and records one receipt", async () => {
  const { app, terminal, cleanup } = makeApp([
    { content: "writing", toolCalls: [{ name: "write", arguments: { path: "a.txt", content: "hello\n" } }] },
    { content: "done" },
  ]);
  try {
    const started = app.start();
    const turn = app.submit("write the file");
    await waitFor(() => app.pendingApproval(), "approval");
    assert.equal(app.shellForTest().hasApproval(), true);
    assert.ok(terminal.writes.join("").includes("approval required"));
    app.respond("allow");
    await turn;
    assert.equal(app.phase(), "idle");
    assert.equal(app.pendingApproval(), false);
    assert.equal(app.transcript().filter((item) => item.kind === "receipt").length, 1);
    assert.equal(app.shellForTest().hasApproval(), false);
    app.stop(0);
    assert.equal(await started, 0);
  } finally {
    cleanup();
  }
});

test("pi TUI clears approval state after a provider error", async () => {
  const { app, cleanup } = makeApp([
    { content: "writing", toolCalls: [{ name: "write", arguments: { path: "a.txt", content: "hello\n" } }] },
    { fail: true },
  ]);
  try {
    const started = app.start();
    const turn = app.submit("write then fail");
    await waitFor(() => app.pendingApproval(), "approval");
    app.respond("allow");
    await turn;
    assert.equal(app.pendingApproval(), false);
    assert.equal(app.shellForTest().hasApproval(), false);
    assert.equal(app.phase(), "idle");
    assert.ok(app.transcript().some((item) => item.kind === "receipt" || item.kind === "error"));
    app.stop(0);
    await started;
  } finally {
    app.stop(0);
    cleanup();
  }
});

test("pi shell repaints across three frames and two approval modal cycles", async () => {
  const terminal = new FakeTerminal();
  const shell = new GidorahShell(terminal, { color: false, onSubmit: () => {}, onQuit: () => {}, onInterrupt: () => {}, onScroll: () => {} });
  try {
    shell.start();
    shell.setHeader(["Gidorah  the governed coding agent", "cwd: /repo  ·  branch: main  ·  session: ses_1  ·  mode: mock  ·  model: gidorah-auto"]);
    shell.setStatus("mode: mock  route: mock/mock  budget: $0.0000/$1.00  research: 0/50  dlp: clean  cache: 0%  context: 0%  compaction: off");
    for (let frame = 0; frame < 3; frame += 1) {
      shell.addText(`› task ${frame}`);
      shell.addMarkdown(`assistant reply ${frame}`);
      shell.addToolCard({ name: "write", args: "a.txt", status: "ok", elapsedMs: 5, result: "created a.txt" });
      shell.addReceipt(`success · ${frame}`);
      if (frame < 2) {
        shell.showApproval({ tool: "bash", risk: "shell", diff: [{ kind: "context", text: "npm test -- --watch" }], queueCount: 1 }, () => {});
        await new Promise((resolve) => setTimeout(resolve, 40));
        const frameText = shell.snapshot(100, 32);
        assert.match(frameText, /approval required/);
        assert.match(frameText, /\[y\] allow/);
        shell.hideApproval();
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    await new Promise((resolve) => setTimeout(resolve, 60));
    const final = shell.snapshot(100, 32);
    assert.match(final, /task 2/);
    assert.equal(final.includes("approval required"), false);
    assert.ok(terminal.writes.length >= 3);
    assert.ok(terminal.writes.join("").includes("approval required"));
    assert.ok(terminal.writes.join("").includes("task 2"));
  } finally {
    shell.stop();
  }
});