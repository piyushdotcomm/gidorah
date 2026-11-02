import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DEFAULT_POLICY } from "../../policy/src/schema.ts";
import { buildContext, capToolResult, clearOldToolResults, maybeCompact, prefixHash, SYSTEM_PROMPT } from "../src/context.ts";
import { buildAuditBundle, exportAudit, Session, verifyChain } from "../src/session.ts";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "gidorah-core-"));
}

test("session appends a valid hash chain and detects tampering", () => {
  const dir = tempDir();
  try {
    const session = Session.create({ dir, cwd: dir, user: "alice", mode: "cloud", policyVersion: "1", sessionId: "ses_a" });
    session.append("turn/start", { turn: 1 });
    session.append("user/message", { content: "fix the failing test" });
    session.append("route/changed", { from: { provider: "deepseek", model: "deepseek-pro" }, to: { provider: "deepseek", model: "deepseek-flash" }, reason: "429", fallbackIndex: 1 });
    session.append("turn/end", { turn: 1, reason: "done" });

    const verification = session.verify();
    assert.equal(verification.valid, true);
    assert.equal(verification.count, 5);
    assert.equal(verification.head, session.all.at(-1)!.hash);

    const tampered = session.all.map((event) => ({ ...event }));
    tampered[2] = { ...tampered[2]!, data: { content: "changed by attacker" } };
    const bad = verifyChain(tampered);
    assert.equal(bad.valid, false);
    assert.equal(bad.brokenAt, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("session reload verifies the chain and resume closes open boundaries", () => {
  const dir = tempDir();
  try {
    const session = Session.create({ dir, cwd: dir, user: "alice", mode: "cloud", policyVersion: "1", sessionId: "ses_b" });
    session.append("turn/start", { turn: 1 });
    session.append("step/start", { turn: 1, step: 1, phase: "explore" });
    session.append("tool/call", { callId: "call_1", name: "read", args: { path: "a.ts" } });

    const loaded = Session.load(session.file);
    assert.equal(loaded.verify().valid, true);
    const closed = loaded.closeOpenBoundaries();
    assert.ok(closed.length >= 2);
    assert.equal(loaded.verify().valid, true);
    const types = loaded.all.map((event) => event.type);
    assert.ok(types.includes("tool/result"));
    assert.ok(types.includes("turn/end"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("audit export is redacted and includes chain verification", () => {
  const dir = tempDir();
  try {
    const session = Session.create({ dir, cwd: dir, user: "alice", mode: "cloud", policyVersion: "1", sessionId: "ses_c" });
    const fakeSecret = ["AKIA", "ABCDEFGHIJKLMNOP"].join("");
    session.append("dlp/blocked", { class: "aws-access-key", hash: "abc123", action: "blocked" });
    session.append("user/message", { content: `leaked ${fakeSecret}` });
    const bundle = buildAuditBundle(session.all, { anchorPath: "audit-anchor.log:1" });
    assert.equal(bundle.chain.valid, true);
    assert.equal(bundle.dlp.length, 1);
    const json = exportAudit(session.all, "json");
    assert.ok(!json.includes(fakeSecret));
    assert.ok(json.includes('"valid": true'));
    const markdown = exportAudit(session.all, "markdown");
    assert.ok(markdown.includes("Tamper-evident"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cap keeps errors and spills a pointer, not silently truncating", () => {
  const lines = Array.from({ length: 400 }, (_, index) => `line ${index} ${"x".repeat(40)}`);
  lines[200] = "Error: ECONNREFUSED cannot connect to 127.0.0.1";
  const capped = capToolResult(lines.join("\n"), 500, ".gidorah/artifacts/ses/call_1.txt");
  assert.equal(capped.pruned, true);
  assert.ok(capped.text.includes("ECONNREFUSED"));
  assert.ok(capped.text.includes("Full output: .gidorah/artifacts/ses/call_1.txt"));
});

test("clear keeps recent tool results and clearing keeps call records", () => {
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "tool" as const, content: "old result 1", toolCallId: "c1" },
    { role: "assistant" as const, content: "next" },
    { role: "tool" as const, content: "old result 2", toolCallId: "c2" },
    { role: "tool" as const, content: "recent result 3", toolCallId: "c3" },
  ];
  const cleared = clearOldToolResults(messages, 1);
  assert.equal(cleared.cleared, 2);
  assert.equal(cleared.messages.filter((message) => message.role === "tool").length, 3);
  assert.ok(cleared.messages.some((message) => message.content === "recent result 3"));
  assert.ok(cleared.messages.some((message) => message.content.includes("cleared")));
});

test("compaction is conditional and skipped below pressure", () => {
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: "task" },
  ];
  assert.equal(maybeCompact(messages, DEFAULT_POLICY, 0.2), null);
  const tight = { ...DEFAULT_POLICY, context: { ...DEFAULT_POLICY.context, compact_at_pressure: 0.1 } };
  const result = maybeCompact(messages, tight, 0.5);
  assert.ok(result !== null);
  assert.ok(result.summary.includes("task_state"));
  assert.ok(result.netCostUsd >= 0);
});

test("prefix hash is stable and independent of live budget status", () => {
  const first = prefixHash(["read", "edit", "bash"]);
  const second = prefixHash(["read", "edit", "bash"]);
  assert.equal(first, second);
  assert.notEqual(first, prefixHash(["read", "edit"]));
});

test("buildContext caps tool output before it enters history and reports metrics", () => {
  const dir = tempDir();
  try {
    const session = Session.create({ dir, cwd: dir, user: "alice", mode: "cloud", policyVersion: "1", sessionId: "ses_ctx" });
    session.append("user/message", { content: "fix it" });
    session.append("tool/call", { callId: "c1", name: "read", args: {} });
    session.append("tool/result", { callId: "c1", ok: true, content: [{ type: "text", text: "y".repeat(80_000) }] });
    const built = buildContext(session.all, { policy: DEFAULT_POLICY });
    const toolMessage = built.messages.find((message) => message.role === "tool");
    assert.ok(toolMessage !== undefined);
    assert.ok(toolMessage.content.length < 80_000);
    assert.equal(built.context.capTokens, 4000);
    assert.equal(built.context.prefixHash, built.prefixHash);
    assert.equal(built.compacted, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("session file is append-only JSONL on disk", () => {
  const dir = tempDir();
  try {
    const session = Session.create({ dir, cwd: dir, user: "alice", mode: "mock", policyVersion: "1", sessionId: "ses_d" });
    session.append("user/message", { content: "a" });
    session.append("user/message", { content: "b" });
    const lines = readFileSync(session.file, "utf8").trim().split("\n");
    assert.equal(lines.length, 3);
    assert.equal(JSON.parse(lines[1]!).type, "user/message");
    const before = readFileSync(session.file, "utf8");
    session.append("user/message", { content: "c" });
    const after = readFileSync(session.file, "utf8");
    assert.ok(after.startsWith(before));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
