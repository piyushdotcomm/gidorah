import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { PassThrough } from "node:stream";
import { BudgetService, type BudgetSnapshot } from "../../../packages/core/src/runtime.ts";
import { runProcess, createDefaultTools } from "../../../packages/core/src/tools.ts";
import { Session } from "../../../packages/core/src/session.ts";
import { classifyToolCall } from "../../../packages/policy/src/approval.ts";
import { classifyRepo } from "../../../packages/policy/src/classify.ts";
import { DEFAULT_POLICY } from "../../../packages/policy/src/schema.ts";
import type { ModelClient, ModelResponse, ToolCall } from "../../../packages/shared/src/types.ts";
import { TuiApp, listSessionEntries, type TuiHooks } from "../src/app.ts";
import { classifyKey } from "../src/keys.ts";
import { displayWidth, truncate, wrapText } from "../src/layout.ts";

interface Step {
  content?: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
}

function response(content: string, toolCalls: ToolCall[]): ModelResponse {
  return {
    id: "fake",
    content,
    toolCalls,
    usage: { input: 5, output: 3, cacheRead: 0, cacheWrite: 0, total: 8 },
    routing: {
      requested: { provider: "mock", model: "mock-flash" },
      served: { provider: "mock", model: "mock-flash" },
      fallback: false,
      cacheHit: false,
      latencyMs: 1,
    },
    finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
  };
}

function fakeModel(steps: Step[], deltas: boolean): ModelClient & { calls: number } {
  let index = 0;
  const model = {
    calls: 0,
    async complete(): Promise<ModelResponse> {
      const step = steps[Math.min(index, steps.length - 1)]!;
      index += 1;
      model.calls += 1;
      return response(step.content ?? "", (step.toolCalls ?? []).map((call, i) => ({ id: `call_${index}_${i}`, name: call.name, arguments: call.arguments })));
    },
    async *stream(): AsyncIterable<{ type: "delta"; text: string } | { type: "done"; response: ModelResponse }> {
      const step = steps[Math.min(index, steps.length - 1)]!;
      index += 1;
      model.calls += 1;
      const final = response(step.content ?? "", (step.toolCalls ?? []).map((call, i) => ({ id: `call_${index}_${i}`, name: call.name, arguments: call.arguments })));
      if (deltas && final.content !== "") {
        for (const piece of final.content.match(/[\s\S]{1,6}/g) ?? []) yield { type: "delta", text: piece };
      }
      yield { type: "done", response: final };
    },
  };
  return model;
}

function fakeIO(): { stdin: NodeJS.ReadStream; stdout: NodeJS.WriteStream } {
  const stream = {
    isTTY: false,
    columns: 100,
    rows: 30,
    write: () => true,
    on: () => stream,
    off: () => stream,
    pause: () => stream,
    resume: () => stream,
    setRawMode: () => stream,
  };
  return { stdin: stream as unknown as NodeJS.ReadStream, stdout: stream as unknown as NodeJS.WriteStream };
}

function makeApp(options: { model: ModelClient; deltas?: boolean; root?: string }): { app: TuiApp; root: string; session: Session; cleanup: () => void } {
  const root = options.root ?? mkdtempSync(join(tmpdir(), "gidorah-tui-"));
  const session = Session.create({ dir: join(root, ".sessions"), cwd: root, user: "test", mode: "cloud", policyVersion: "1" });
  const policy = DEFAULT_POLICY;
  const classification = classifyRepo(policy, root);
  const budget = new BudgetService(1, 1);
  const deps = (target: Session, hooks: TuiHooks) => ({
    model: options.model,
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
  });
  const io = fakeIO();
  const snap = (): BudgetSnapshot => budget.snapshot();
  const app = new TuiApp({
    session,
    createDeps: deps,
    createSession: () => Session.create({ dir: join(root, ".sessions"), cwd: root, user: "test", mode: "cloud", policyVersion: "1" }),
    listSessions: () => listSessionEntries(join(root, ".sessions")),
    loadSession: (id) => Session.load(join(root, ".sessions", id, "session.jsonl")),
    budgetSnapshot: snap,
    resetBudget: () => undefined,
    cwd: root,
    branch: "test",
    mode: "mock",
    modelAlias: "gidorah-auto",
    color: false,
    width: 100,
    height: 30,
    historyFile: join(root, "tui-history"),
    stdin: io.stdin,
    stdout: io.stdout,
  });
  return { app, root, session, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

async function waitFor(check: () => boolean, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for condition");
}

test("TUI renders the required panels", () => {
  const { app, cleanup } = makeApp({ model: fakeModel([{ content: "hi" }], false) });
  try {
    const screen = app.snapshot(100, 30);
    assert.match(screen, /Gidorah/);
    assert.match(screen, /cwd:/);
    assert.match(screen, /session:/);
    assert.match(screen, /mode:/);
    assert.match(screen, /Enter send/);
  } finally {
    cleanup();
  }
});

test("TUI submits a task, streams deltas, and records a receipt", async () => {
  const { app, cleanup } = makeApp({ model: fakeModel([{ content: "hello from the model" }], true) });
  try {
    await app.submit("say hi");
    const kinds = app.transcript().map((item) => item.kind);
    assert.ok(kinds.includes("user"));
    assert.ok(kinds.includes("assistant"));
    assert.ok(kinds.includes("receipt"));
    const screen = app.snapshot(100, 30);
    assert.match(screen, /say hi/);
    assert.match(screen, /hello from the model/);
    assert.match(screen, /receipt/);
  } finally {
    cleanup();
  }
});

test("TUI approval: allow runs the tool, deny does not", async () => {
  for (const decision of ["allow", "deny"] as const) {
    const { app, root, cleanup } = makeApp({
      model: fakeModel(
        [
          { content: "writing", toolCalls: [{ name: "write", arguments: { path: "tui-demo.txt", content: "hello\n" } }] },
          { content: "done" },
        ],
        false,
      ),
    });
    try {
      const pending = app.submit("write the demo file");
      await waitFor(() => app.pendingApproval());
      const panel = app.snapshot(100, 30);
      assert.match(panel, /approval required/);
      assert.match(panel, /\[y\] allow/);
      assert.match(panel, /write/);
      app.respond(decision);
      await pending;
      const tool = app.transcript().find((item) => item.kind === "tool");
      assert.ok(tool !== undefined && tool.kind === "tool");
      assert.equal(tool.tool.status, decision === "allow" ? "ok" : "denied");
      assert.equal(existsSync(join(root, "tui-demo.txt")), decision === "allow");
    } finally {
      cleanup();
    }
  }
});

test("TUI keys: edit, backspace, history, submit", async () => {
  const { app, cleanup } = makeApp({ model: fakeModel([{ content: "ok" }], false) });
  try {
    app.handleKey("h", { name: "h", sequence: "h" });
    app.handleKey("i", { name: "i", sequence: "i" });
    assert.match(app.snapshot(100, 30), /› hi/);
    app.handleKey(undefined, { name: "backspace" });
    assert.match(app.snapshot(100, 30), /› h/);
    app.handleKey(undefined, { name: "enter" });
    await waitFor(() => app.transcript().some((item) => item.kind === "receipt"));
    app.handleKey(undefined, { name: "up" });
    assert.match(app.snapshot(100, 30), /› h/);
  } finally {
    cleanup();
  }
});

test("TUI slash commands: help, status, trace, receipt, new, quit", async () => {
  const { app, cleanup } = makeApp({ model: fakeModel([{ content: "ok" }], false) });
  try {
    app.handleKey("/", { name: "/", sequence: "/" });
    for (const char of "help") app.handleKey(char, { name: char, sequence: char });
    app.handleKey(undefined, { name: "enter" });
    await waitFor(() => app.transcript().some((item) => item.kind === "info" && item.text.includes("/status")));
    await app.submit("/status");
    await app.submit("/trace");
    await app.submit("/receipt");
    const info = app.transcript().filter((item) => item.kind === "info").map((item) => item.kind === "info" ? item.text : "").join("\n");
    assert.match(info, /session/);
    assert.match(info, /no trace yet|Phase/);
    await app.submit("/new");
    assert.ok(app.transcript().some((item) => item.kind === "notice" && item.text.includes("new session")));
    await app.submit("/quit");
    assert.equal(app.phase(), "exited");
  } finally {
    cleanup();
  }
});

test("TUI sanitizes untrusted model text", async () => {
  const { app, cleanup } = makeApp({ model: fakeModel([{ content: "\u001b[31mred\u001b[0m\u0007 ok" }], false) });
  try {
    await app.submit("sanitize");
    const screen = app.snapshot(100, 30);
    assert.equal(screen.includes("\u001b[31m"), false);
    assert.equal(screen.includes("\u0007"), false);
    assert.match(screen, /red/);
  } finally {
    cleanup();
  }
});

test("keys decode control keys and arrows", () => {
  assert.deepEqual(classifyKey(undefined, { name: "c", ctrl: true }), { type: "ctrl-c" });
  assert.deepEqual(classifyKey(undefined, { name: "d", ctrl: true }), { type: "ctrl-d" });
  assert.deepEqual(classifyKey(undefined, { name: "up" }), { type: "up" });
  assert.deepEqual(classifyKey("a", { name: "a", sequence: "a" }), { type: "char", text: "a" });
  assert.deepEqual(classifyKey("\u001b", { name: "escape" }), { type: "escape" });
});

test("layout wraps and truncates by display width", () => {
  assert.equal(displayWidth("abc"), 3);
  assert.equal(displayWidth("漢"), 2);
  assert.equal(truncate("abcdef", 4), "abc…");
  assert.deepEqual(wrapText("one two three", 7), ["one two", "three"]);
  assert.deepEqual(wrapText("abcdefgh", 4), ["abcd", "efgh"]);
});

function fakeTTY(): { stdin: NodeJS.ReadStream; stdout: NodeJS.WriteStream; written: string[] } {
  const written: string[] = [];
  const stdin = new PassThrough() as unknown as NodeJS.ReadStream & { isTTY: boolean; setRawMode: () => void };
  Object.assign(stdin, { isTTY: true, setRawMode: () => undefined });
  const stdout = new PassThrough() as unknown as NodeJS.WriteStream & { columns: number; rows: number };
  Object.assign(stdout, { isTTY: true, columns: 100, rows: 30 });
  stdout.on("data", (chunk: Buffer | string) => written.push(chunk.toString()));
  return { stdin, stdout, written };
}

test("TUI interactive lifecycle enters and restores the alternate screen", async () => {
  const root = mkdtempSync(join(tmpdir(), "gidorah-tui-tty-"));
  try {
    const session = Session.create({ dir: join(root, ".sessions"), cwd: root, user: "test", mode: "cloud", policyVersion: "1" });
    const tty = fakeTTY();
    const model = fakeModel([{ content: "hi" }], false);
    const policy = DEFAULT_POLICY;
    const classification = classifyRepo(policy, root);
    const budget = new BudgetService(1, 1);
    const app = new TuiApp({
      session,
      createDeps: (_target, hooks) => ({
        model,
        tools: createDefaultTools(),
        approval: hooks.approval,
        budget,
        policy,
        repoClass: classification.mode,
        workspaceRoot: root,
        run: runProcess,
        estimateCost: () => 0,
        classifyTool: (tool: string, args: Record<string, unknown>) => classifyToolCall(tool, args, { policy, classification, cwd: root, workspaceRoot: root }),
      }),
      createSession: () => Session.create({ dir: join(root, ".sessions"), cwd: root, user: "test", mode: "cloud", policyVersion: "1" }),
      listSessions: () => [],
      loadSession: () => session,
      budgetSnapshot: () => budget.snapshot(),
      cwd: root,
      branch: "test",
      mode: "mock",
      modelAlias: "gidorah-auto",
      color: false,
      stdin: tty.stdin,
      stdout: tty.stdout,
      historyFile: join(root, "history"),
    });
    const started = app.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(tty.written.join("").includes("\u001b[?1049h"));
    app.stop(0);
    assert.equal(await started, 0);
    const output = tty.written.join("");
    assert.ok(output.includes("\u001b[?25h"));
    assert.ok(output.includes("Gidorah"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("TUI /resume lists sessions and resumes the chosen one", async () => {
  const { app, root, cleanup } = makeApp({ model: fakeModel([{ content: "ok" }], false) });
  try {
    await app.submit("first task");
    await app.submit("/resume");
    assert.match(app.snapshot(100, 30), /Sessions:/);
    app.handleKey("1", { name: "1", sequence: "1" });
    app.handleKey(undefined, { name: "enter" });
    await waitFor(() => app.transcript().some((item) => item.kind === "info" && item.text.includes("resumed")));
    assert.ok(app.transcript().some((item) => item.kind === "info" && item.text.includes("resumed ses_")));
  } finally {
    cleanup();
  }
});

test("TUI Ctrl+D exits and Ctrl+C arms then exits", async () => {
  const { app, cleanup } = makeApp({ model: fakeModel([{ content: "ok" }], false) });
  try {
    app.handleKey(undefined, { name: "c", ctrl: true });
    assert.notEqual(app.phase(), "exited");
    app.handleKey(undefined, { name: "c", ctrl: true });
    assert.equal(app.phase(), "exited");
  } finally {
    cleanup();
  }
  const second = makeApp({ model: fakeModel([{ content: "ok" }], false) });
  try {
    second.app.handleKey(undefined, { name: "d", ctrl: true });
    assert.equal(second.app.phase(), "exited");
  } finally {
    second.cleanup();
  }
});