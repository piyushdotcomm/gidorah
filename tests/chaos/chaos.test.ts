/**
 * Chaos suite: kill each dependency and verify the documented behavior
 * (system-overview.md §5, CT-33). Offline equivalents of the real kills.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createBifrostClient } from "../../packages/bifrost/src/client.ts";
import { startMockGateway, startMockProvider } from "../../packages/bifrost/src/index.ts";
import { Session } from "../../packages/core/src/session.ts";
import { createScout, MockTavilyClient, ResearchCache } from "../../packages/tavily/src/scout.ts";
import { DEFAULT_POLICY } from "../../packages/policy/src/schema.ts";

const req = { messages: [{ role: "user" as const, content: "task" }], modelAlias: "gidorah-auto", phase: "explore" as const, sessionId: "ses_chaos", confidential: false };

async function gatewayHarness() {
  const deepseek = await startMockProvider({ script: [{ content: "ok" }], name: "deepseek" });
  const ollama = await startMockProvider({ script: [{ content: "local" }], name: "ollama" });
  const gateway = await startMockGateway({
    upstreams: { deepseek: deepseek.url, ollama: ollama.url },
    virtualKeys: [
      { name: "vk-cloud", kind: "cloud", providers: ["deepseek"], budgetUsd: 10, usedUsd: 0 },
      { name: "vk-local", kind: "local", providers: ["ollama"], budgetUsd: 0, usedUsd: 0 },
    ],
    routing: {
      aliases: { "gidorah-auto": "deepseek/deepseek-flash", "gidorah-local": "ollama/qwen2.5-coder:3b" },
      phases: { explore: "deepseek/deepseek-flash", edit: "deepseek/deepseek-flash", verify: "deepseek/deepseek-pro", research: "deepseek/deepseek-flash", other: "deepseek/deepseek-flash" },
      fallbacks: {},
    },
  });
  return { deepseek, ollama, gateway, client: createBifrostClient({ baseUrl: gateway.url, virtualKey: "vk-cloud" }), localClient: createBifrostClient({ baseUrl: gateway.url, virtualKey: "vk-local" }) };
}

test("chaos: killing Bifrost stops model traffic with a clear error", async () => {
  const h = await gatewayHarness();
  await h.gateway.close();
  try {
    await assert.rejects(() => h.client.complete(req), /Bifrost unreachable|ProviderError|fetch failed/i);
  } finally {
    await h.deepseek.close();
    await h.ollama.close();
  }
});

test("chaos: killing Ollama never causes a silent cloud fallback in confidential mode", async () => {
  const h = await gatewayHarness();
  try {
    await h.ollama.close();
    const before = h.deepseek.requests.length;
    await assert.rejects(() => h.localClient.complete({ ...req, modelAlias: "gidorah-local", confidential: true }), /ProviderError|Bifrost upstream error/i);
    assert.equal(h.deepseek.requests.length, before, "no cloud request may happen in confidential mode");
  } finally {
    await h.gateway.close();
    await h.deepseek.close();
  }
});

test("chaos: killing Tavily degrades to cache or skip without blocking", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gidorah-chaos-"));
  const cache = new ResearchCache({ dbPath: join(dir, "r.db") });
  const client = new MockTavilyClient({ results: [], failures: { serverError: 3 } });
  try {
    const scout = createScout({ client, cache, policy: DEFAULT_POLICY, userId: "alice" });
    const outcome = await scout.research({ question: "q", taskId: "t1" }, { confidential: false });
    assert.equal(outcome.status, "unavailable");
  } finally {
    cache.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("chaos: dropping the network keeps confidential mode independent", async () => {
  const client = createBifrostClient({ baseUrl: "http://127.0.0.1:1", virtualKey: "vk" });
  await assert.rejects(() => client.complete({ ...req, confidential: true }), /Bifrost unreachable|ProviderError/i);
});

test("chaos: killing the process mid-turn resumes with an intact chain", () => {
  const dir = mkdtempSync(join(tmpdir(), "gidorah-chaos-resume-"));
  try {
    const session = Session.create({ dir, cwd: dir, user: "alice", mode: "cloud", policyVersion: "1", sessionId: "ses_crash" });
    session.append("turn/start", { turn: 1 });
    session.append("tool/call", { callId: "c1", name: "read", args: {} });
    const loaded = Session.load(session.file);
    const closed = loaded.closeOpenBoundaries();
    assert.ok(closed.length > 0);
    assert.equal(loaded.verify().valid, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
