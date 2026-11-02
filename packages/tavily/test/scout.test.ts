import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DEFAULT_POLICY } from "../../policy/src/schema.ts";
import type { ResearchQuery } from "../../shared/src/types.ts";
import { buildQuery, compressToCard, createScout, MockTavilyClient, ResearchCache } from "../src/scout.ts";

const STRIPE_RESULTS = [
  {
    title: "Stripe webhook signatures",
    url: "https://docs.stripe.com/webhooks/signature",
    content:
      "Use stripe.webhooks.constructEvent(rawBody, signature, secret). The raw request body is required; do not JSON-parse before verification. The stripe-signature header carries the signature. It throws StripeSignatureVerificationError on failure.",
    score: 0.95,
  },
  {
    title: "stripe-node README",
    url: "https://github.com/stripe/stripe-node",
    content:
      "The stripe-node SDK exposes constructEvent on the webhooks resource. Always verify against the raw payload and the endpoint secret from the dashboard.",
    score: 0.8,
  },
];

function query(overrides: Partial<ResearchQuery> = {}): ResearchQuery {
  return {
    question: "Correct Stripe webhook signature verification",
    packageName: "stripe",
    packageVersion: "18.2.0",
    taskId: "task_1",
    ...overrides,
  };
}

function harness(options: { creditsPerDay?: number; callsPerTask?: number; results?: typeof STRIPE_RESULTS } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "gidorah-tavily-"));
  const cache = new ResearchCache({ dbPath: join(dir, "research.db") });
  const client = new MockTavilyClient({ results: options.results ?? STRIPE_RESULTS });
  const policy = {
    ...DEFAULT_POLICY,
    budgets: {
      ...DEFAULT_POLICY.budgets,
      research: {
        credits_per_day: options.creditsPerDay ?? 50,
        calls_per_task: options.callsPerTask ?? 2,
      },
    },
  };
  const scout = createScout({ client, cache, policy, userId: "alice" });
  return {
    dir,
    cache,
    client,
    scout,
    cleanup: () => {
      cache.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("local knowledge answer short-circuits before any Tavily call", async () => {
  const h = harness();
  try {
    const scout = createScout({
      client: h.client,
      cache: h.cache,
      policy: DEFAULT_POLICY,
      userId: "alice",
      localLookup: async () => "the answer is already in node_modules docs",
    });
    const outcome = await scout.research(query(), { confidential: false });
    assert.equal(outcome.status, "local_answer");
    assert.equal(h.client.queries.length, 0);
  } finally {
    h.cleanup();
  }
});

test("docs-dependent query builds a cited card within the token cap", async () => {
  const h = harness();
  try {
    const outcome = await h.scout.research(query(), { confidential: false });
    assert.equal(outcome.status, "card");
    if (outcome.status !== "card") return;
    assert.ok(outcome.card.sources.length >= 2);
    assert.ok(outcome.card.facts.length > 0);
    assert.ok(outcome.card.tokenEstimate <= DEFAULT_POLICY.research.card_token_cap);
    assert.equal(outcome.card.confidence, "high");
    assert.equal(outcome.cached, false);
    assert.ok(outcome.card.sources.every((source) => source.url.startsWith("https://")));
    assert.ok(h.client.queries[0]!.text.includes("stripe 18.2.0"));
    assert.equal(h.cache.usageToday("alice").calls, 1);
  } finally {
    h.cleanup();
  }
});

test("cache hit avoids a second call and spends no credits", async () => {
  const h = harness();
  try {
    const first = await h.scout.research(query(), { confidential: false });
    const second = await h.scout.research(query(), { confidential: false });
    assert.equal(first.status, "card");
    assert.equal(second.status, "card");
    if (second.status !== "card") return;
    assert.equal(second.cached, true);
    assert.equal(second.credits, 0);
    assert.equal(h.client.queries.length, 1);
    assert.equal(h.cache.usageToday("alice").credits, 1);
  } finally {
    h.cleanup();
  }
});

test("a version bump misses the cache", async () => {
  const h = harness();
  try {
    await h.scout.research(query({ packageVersion: "18.2.0" }), { confidential: false });
    await h.scout.research(query({ packageVersion: "19.0.0" }), { confidential: false });
    assert.equal(h.client.queries.length, 2);
  } finally {
    h.cleanup();
  }
});

test("confidential mode denies research and makes zero calls", async () => {
  const h = harness();
  try {
    const outcome = await h.scout.research(query(), { confidential: true });
    assert.equal(outcome.status, "denied");
    assert.equal(h.client.queries.length, 0);
  } finally {
    h.cleanup();
  }
});

test("task research cap denies the third call but cache still serves", async () => {
  const h = harness();
  try {
    await h.scout.research(query({ question: "stripe webhook q1" }), { confidential: false });
    await h.scout.research(query({ question: "stripe webhook q2" }), { confidential: false });
    const third = await h.scout.research(query({ question: "stripe webhook q3" }), { confidential: false });
    assert.equal(third.status, "denied");
    assert.match(third.status === "denied" ? third.reason : "", /task research cap/);
    const cached = await h.scout.research(query({ question: "stripe webhook q1" }), { confidential: false });
    assert.equal(cached.status, "card");
    if (cached.status === "card") assert.equal(cached.cached, true);
  } finally {
    h.cleanup();
  }
});

test("credit budget exhaustion degrades to cache only", async () => {
  const h = harness({ creditsPerDay: 1 });
  try {
    const first = await h.scout.research(query({ question: "stripe q1" }), { confidential: false });
    assert.equal(first.status, "card");
    const second = await h.scout.research(query({ question: "stripe q2" }), { confidential: false });
    assert.equal(second.status, "budget_exhausted");
    const cached = await h.scout.research(query({ question: "stripe q1" }), { confidential: false });
    assert.equal(cached.status, "card");
  } finally {
    h.cleanup();
  }
});

test("Tavily outage never blocks the coding task", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gidorah-tavily-fail-"));
  const cache = new ResearchCache({ dbPath: join(dir, "research.db") });
  const client = new MockTavilyClient({ results: STRIPE_RESULTS, failures: { rateLimit: 1 } });
  const scout = createScout({ client, cache, policy: DEFAULT_POLICY, userId: "alice" });
  try {
    const outcome = await scout.research(query(), { confidential: false });
    assert.equal(outcome.status, "unavailable");
    assert.match(outcome.status === "unavailable" ? outcome.reason : "", /Tavily unavailable/);
  } finally {
    cache.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("queries never carry secrets", async () => {
  const h = harness();
  try {
    const secret = ["AKIA", "ABCDEFGHIJKLMNOP"].join("");
    const outcome = await h.scout.research(query({ errorText: `failed with ${secret}` }), { confidential: false });
    assert.equal(outcome.status, "denied");
    assert.equal(h.client.queries.length, 0);
  } finally {
    h.cleanup();
  }
});

test("buildQuery is version-aware and card compression enforces the cap", () => {
  const built = buildQuery(query(), DEFAULT_POLICY);
  assert.ok(built.query.includes("stripe 18.2.0"));
  assert.ok(built.query.length <= 200);
  assert.equal(built.cacheKey.length, 64);

  const longResults = Array.from({ length: 4 }, (_, index) => ({
    title: `doc ${index}`,
    url: `https://docs.example.com/${index}`,
    content: `Fact number ${index}. `.repeat(40),
    score: 0.5,
  }));
  const card = compressToCard(longResults, "question", { tokenCap: 300, cached: false });
  assert.ok(card.tokenEstimate <= 300);
  assert.ok(card.sources.length === 4);
});
