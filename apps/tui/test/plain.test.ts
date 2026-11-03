import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { BudgetService } from "../../../packages/core/src/runtime.ts";
import { runProcess, createDefaultTools } from "../../../packages/core/src/tools.ts";
import { Session } from "../../../packages/core/src/session.ts";
import { classifyToolCall } from "../../../packages/policy/src/approval.ts";
import { classifyRepo } from "../../../packages/policy/src/classify.ts";
import { DEFAULT_POLICY } from "../../../packages/policy/src/schema.ts";
import type { ModelClient, ModelResponse } from "../../../packages/shared/src/types.ts";
import { PLAIN_COMMANDS, runPlainTui } from "../src/plain.ts";

function fakeModel(): ModelClient {
  const reply: ModelResponse = {
    id: "m1",
    content: "plain reply",
    toolCalls: [],
    usage: { input: 3, output: 2, cacheRead: 0, cacheWrite: 0, total: 5 },
    routing: { requested: { provider: "mock", model: "mock" }, served: { provider: "mock", model: "mock" }, fallback: false, cacheHit: false, latencyMs: 1 },
    finishReason: "stop",
  };
  return {
    async complete() {
      return reply;
    },
    async *stream() {
      yield { type: "delta" as const, text: "plain reply" };
      yield { type: "done" as const, response: reply };
    },
  };
}

test("plain mode handles every command it advertises", async () => {
  const root = mkdtempSync(join(tmpdir(), "gidorah-plain-"));
  try {
    const session = Session.create({ dir: join(root, ".sessions"), cwd: root, user: "test", mode: "cloud", policyVersion: "1" });
    const policy = DEFAULT_POLICY;
    const classification = classifyRepo(policy, root);
    const budget = new BudgetService(1, 1);
    const deps = (_target: Session, hooks: { approval: import("../../../packages/core/src/runtime.ts").ApprovalService; onModelDelta?: (text: string) => void }) => ({
      model: fakeModel(),
      tools: createDefaultTools(),
      approval: hooks.approval,
      budget,
      policy,
      repoClass: classification.mode,
      workspaceRoot: root,
      run: runProcess,
      estimateCost: () => 0.0001,
      classifyTool: (tool: string, args: Record<string, unknown>) => classifyToolCall(tool, args, { policy, classification, cwd: root, workspaceRoot: root }),
    });
    const input = new PassThrough();
    const output = new PassThrough();
    let captured = "";
    output.on("data", (chunk: Buffer | string) => {
      captured += chunk.toString();
    });
    for (const command of PLAIN_COMMANDS) input.write(`${command}\ntask hello\n`);
    input.end();
    const code = await runPlainTui({
      session,
      createDeps: deps,
      createSession: () => Session.create({ dir: join(root, ".sessions"), cwd: root, user: "test", mode: "cloud", policyVersion: "1" }),
      listSessions: () => [{ id: session.header.sessionId, label: `${session.header.sessionId} · task hello` }],
      loadSession: () => session,
      budgetSnapshot: () => budget.snapshot(),
      cwd: root,
      mode: "mock",
      modelAlias: "gidorah-auto",
      availableAliases: ["gidorah-auto"],
      stdin: input as unknown as NodeJS.ReadStream,
      stdout: output as unknown as NodeJS.WriteStream,
    });
    assert.equal(code, 0);
    assert.equal(captured.includes("unknown command"), false);
    assert.match(captured, /model alias: gidorah-auto/);
    assert.match(captured, /receipt:/);
    assert.match(captured, /plain reply/);
    assert.equal(captured.includes("\u001b["), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI tui --plain uses the generic mock reply, not the demo script", async () => {
  const root = mkdtempSync(join(tmpdir(), "gidorah-mock-"));
  try {
    const input = join(root, "input.txt");
    writeFileSync(input, "hello there\n/quit\n", "utf8");
    const cliRoot = process.cwd();
    const result = await runProcess({
      command: `node apps/cli/src/main.ts tui --plain < "${input}"`,
      args: [],
      cwd: cliRoot,
      shell: true,
      timeoutMs: 60_000,
      env: { ...process.env, GIDORAH_MODE: "mock", GIDORAH_HOME: join(root, "home") },
    });
    assert.equal(result.code, 0);
    assert.match(result.stdout, /mock mode: task acknowledged/);
    assert.equal(result.stdout.includes("I'll write a demo file"), false);
    assert.equal(result.stdout.includes("tui-demo.txt"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});