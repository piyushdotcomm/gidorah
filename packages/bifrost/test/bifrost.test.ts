import assert from "node:assert/strict";
import { test } from "node:test";
import { BudgetExceededError, ProviderError } from "../../shared/src/errors.ts";
import type { ModelRequest } from "../../shared/src/types.ts";
import { createBifrostClient, parseRoutingHeaders } from "../src/client.ts";
import { inspectOutbound, violatesConfidentialGuard } from "../src/dlp.ts";
import { startMockGateway } from "../src/mock-gateway.ts";
import { startMockProvider } from "../src/mock-provider.ts";

// Synthetic credential assembled at runtime so the secret lint stays strict.
const FAKE_AWS = ["AKIA", "ABCDEFGHIJKLMNOP"].join("");

function request(overrides: Partial<ModelRequest> = {}): ModelRequest {
  return {
    messages: [{ role: "user", content: "fix the failing test" }],
    modelAlias: "gidorah-auto",
    phase: "explore",
    sessionId: "ses_test",
    confidential: false,
    ...overrides,
  };
}

async function harness(options: { budgetUsd?: number; failures?: Record<string, number> } = {}) {
  const deepseek = await startMockProvider({ script: [{ content: "cloud answer" }], name: "mock-deepseek" });
  const ollama = await startMockProvider({ script: [{ content: "local answer" }], name: "mock-ollama" });
  const gateway = await startMockGateway({
    upstreams: { deepseek: deepseek.url, ollama: ollama.url },
    virtualKeys: [
      { name: "vk-cloud", kind: "cloud", providers: ["deepseek"], budgetUsd: options.budgetUsd ?? 10, usedUsd: 0 },
      { name: "vk-local", kind: "local", providers: ["ollama"], budgetUsd: 0, usedUsd: 0 },
    ],
    routing: {
      aliases: {
        "gidorah-auto": "deepseek/deepseek-flash",
        "gidorah-fast": "deepseek/deepseek-flash",
        "gidorah-strong": "deepseek/deepseek-pro",
        "gidorah-local": "ollama/qwen2.5-coder:3b",
      },
      phases: {
        explore: "deepseek/deepseek-flash",
        edit: "deepseek/deepseek-flash",
        verify: "deepseek/deepseek-pro",
        research: "deepseek/deepseek-flash",
        other: "deepseek/deepseek-flash",
      },
      fallbacks: {
        "deepseek/deepseek-pro": ["deepseek/deepseek-flash"],
        "deepseek/deepseek-flash": ["ollama/qwen2.5-coder:3b"],
      },
    },
    failures: options.failures ?? {},
  });
  const client = createBifrostClient({ baseUrl: gateway.url, virtualKey: "vk-cloud" });
  const localClient = createBifrostClient({ baseUrl: gateway.url, virtualKey: "vk-local" });
  return {
    deepseek,
    ollama,
    gateway,
    client,
    localClient,
    cleanup: async () => {
      await gateway.close();
      await deepseek.close();
      await ollama.close();
    },
  };
}

test("client sends policy headers and parses routing info", async () => {
  const h = await harness();
  try {
    const response = await h.client.complete(request());
    assert.equal(response.content, "cloud answer");
    assert.equal(response.routing.served.model, "deepseek-flash");
    assert.equal(response.routing.fallback, false);
    assert.ok(response.usage.input > 0);
    assert.equal(h.deepseek.requests.length, 1);
    const log = h.gateway.logs[0]!;
    assert.equal(log.phase, "explore");
    assert.equal(log.confidential, false);
    assert.equal(log.sessionId, "ses_test");
    assert.equal(log.requested.model, "deepseek-flash");
    assert.equal(log.status, 200);
    assert.ok(log.costUsd >= 0);
  } finally {
    await h.cleanup();
  }
});

test("phase routing sends verify to the strong model", async () => {
  const h = await harness();
  try {
    const response = await h.client.complete(request({ phase: "verify" }));
    assert.equal(response.routing.served.model, "deepseek-pro");
    assert.equal(h.gateway.logs[0]!.phase, "verify");
  } finally {
    await h.cleanup();
  }
});

test("402 budget is raised before any upstream call and never retried", async () => {
  const h = await harness({ budgetUsd: 0 });
  try {
    await assert.rejects(() => h.client.complete(request()), (error: unknown) => error instanceof BudgetExceededError);
    assert.equal(h.deepseek.requests.length, 0);
    assert.equal(h.ollama.requests.length, 0);
    assert.equal(h.gateway.logs.length, 0);
  } finally {
    await h.cleanup();
  }
});

test("429 from the primary provider produces a visible fallback", async () => {
  const h = await harness({ failures: { "deepseek-pro": 1 } });
  try {
    const response = await h.client.complete(request({ phase: "verify" }));
    assert.equal(response.routing.fallback, true);
    assert.equal(response.routing.fallbackIndex, 1);
    assert.equal(response.routing.served.model, "deepseek-flash");
    assert.equal(response.routing.primary?.model, "deepseek-pro");
    const log = h.gateway.logs[0]!;
    assert.equal(log.fallback, true);
    assert.equal(log.status, 200);
  } finally {
    await h.cleanup();
  }
});

test("confidential requests require the local key and local provider", async () => {
  const h = await harness();
  try {
    await assert.rejects(
      () => h.client.complete(request({ confidential: true, modelAlias: "gidorah-fast" })),
      (error: unknown) => error instanceof ProviderError && error.status === 403,
    );
    const local = await h.localClient.complete(request({ confidential: true, modelAlias: "gidorah-local" }));
    assert.equal(local.content, "local answer");
    assert.equal(local.routing.served.provider, "ollama");
    const log = h.gateway.logs.at(-1)!;
    assert.equal(log.confidential, true);
    assert.equal(h.deepseek.requests.length, 0);
  } finally {
    await h.cleanup();
  }
});

test("cloud model cannot be requested through the local-only key", async () => {
  const h = await harness();
  try {
    await assert.rejects(
      () => h.localClient.complete(request({ modelAlias: "gidorah-strong" })),
      (error: unknown) => error instanceof ProviderError && error.status === 403,
    );
    assert.equal(h.deepseek.requests.length, 0);
  } finally {
    await h.cleanup();
  }
});

test("DLP blocks a secret boundary before cloud egress and logs class plus hash only", async () => {
  const h = await harness();
  try {
    const body = request({ messages: [{ role: "user", content: `deploy with ${FAKE_AWS}` }] });
    await assert.rejects(() => h.client.complete(body), (error: unknown) => error instanceof ProviderError && error.status === 451);
    assert.equal(h.deepseek.requests.length, 0);
    const log = h.gateway.logs.at(-1)!;
    assert.equal(log.dlp?.action, "blocked");
    assert.equal(log.dlp?.class, "aws-access-key");
    assert.ok(!JSON.stringify(h.gateway.logs).includes(FAKE_AWS));
  } finally {
    await h.cleanup();
  }
});

test("streaming yields deltas then a final response with routing", async () => {
  const h = await harness();
  try {
    h.deepseek.setScript([{ content: "streaming answer", usage: { input: 12, output: 4 } }]);
    const chunks: string[] = [];
    let done: { content: string; routing: { served: { model: string } }; usage: { total: number } } | null = null;
    for await (const chunk of h.client.stream(request())) {
      if (chunk.type === "delta") chunks.push(chunk.text);
      if (chunk.type === "done") done = chunk.response;
      if (chunk.type === "error") assert.fail(`unexpected stream error: ${chunk.error.message}`);
    }
    assert.equal(chunks.join(""), "streaming answer");
    assert.ok(done !== null);
    assert.equal(done.content, "streaming answer");
    assert.equal(done.routing.served.model, "deepseek-flash");
  } finally {
    await h.cleanup();
  }
});

test("routing header parsing handles fallback, primary, and cache flags", () => {
  const headers = new Headers({
    "x-bifrost-routing-info-provider": "deepseek",
    "x-bifrost-routing-info-model": "deepseek-flash",
    "x-bifrost-routing-info-requested-provider": "deepseek",
    "x-bifrost-routing-info-requested-model": "deepseek-pro",
    "x-bifrost-routing-info-is-fallback": "true",
    "x-bifrost-fallback-index": "1",
    "x-bifrost-routing-info-primary-provider": "deepseek",
    "x-bifrost-routing-info-primary-model": "deepseek-pro",
    "x-bifrost-upstream-latency-ms": "42",
    "x-bifrost-cache-hit": "true",
    "x-bifrost-request-type": "chat",
  });
  const routing = parseRoutingHeaders(headers, { provider: "deepseek", model: "deepseek-pro" });
  assert.equal(routing.fallback, true);
  assert.equal(routing.fallbackIndex, 1);
  assert.equal(routing.served.model, "deepseek-flash");
  assert.equal(routing.primary?.model, "deepseek-pro");
  assert.equal(routing.cacheHit, true);
  assert.equal(routing.latencyMs, 42);
});

test("DLP unit: block, redact, and allowlist", () => {
  const text = `token ${FAKE_AWS}`;
  const blocked = inspectOutbound(text, { confidential: false, defaultAction: "block" });
  assert.equal(blocked.action, "blocked");
  assert.deepEqual(blocked.classes, ["aws-access-key"]);
  assert.ok(!blocked.body.includes("REDACTED"));

  const redacted = inspectOutbound(text, { confidential: false, defaultAction: "redact" });
  assert.equal(redacted.action, "redacted");
  assert.ok(!redacted.body.includes(FAKE_AWS));

  const allowed = inspectOutbound(text, { confidential: false, defaultAction: "block", allowlist: ["aws-access-key"] });
  assert.equal(allowed.action, "clean");

  assert.equal(inspectOutbound("ordinary prose", { confidential: false, defaultAction: "block" }).action, "clean");
  assert.equal(violatesConfidentialGuard(true, "deepseek"), true);
  assert.equal(violatesConfidentialGuard(true, "ollama"), false);
  assert.equal(violatesConfidentialGuard(false, "deepseek"), false);
});
