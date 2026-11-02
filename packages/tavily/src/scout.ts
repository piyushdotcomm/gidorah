/**
 * Tavily knowledge plane: Scout, query builder, evidence cards, cache, and
 * credit budget (docs/01-architecture/tavily-knowledge-plane.md, ADR-0002).
 *
 * Local-first is enforced by the caller passing a local lookup; the Scout never
 * runs in confidential mode, never sends code or secrets, caps cards, caches by
 * version-aware key, and degrades to cache or "unavailable" without blocking
 * the coding task.
 */
import { DatabaseSync } from "node:sqlite";
import { sha256Hex } from "../../shared/src/canonical.ts";
import { scanSecrets } from "../../shared/src/redaction.ts";
import type {
  EvidenceCard,
  EvidenceSource,
  Policy,
  ResearchClient,
  ResearchOutcome,
  ResearchQuery,
} from "../../shared/src/types.ts";

export const PROMPT_VERSION = "gidorah-research-v1";

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilySearchResponse {
  results: TavilySearchResult[];
  credits: number;
}

export type SearchDepth = "ultra-fast" | "fast" | "basic" | "advanced";

export interface TavilyClient {
  search(query: string, options: { maxResults: number; depth: SearchDepth; domains?: string[] }): Promise<TavilySearchResponse>;
  extract(urls: string[], query: string): Promise<{ content: string; credits: number }>;
}

export interface MockTavilyOptions {
  results?: TavilySearchResult[];
  credits?: number;
  /** Consumed one per call: simulate 429s, 5xx, and timeouts. */
  failures?: { rateLimit?: number; serverError?: number; timeout?: number };
}

export class MockTavilyClient implements TavilyClient {
  readonly queries: Array<{ kind: "search" | "extract"; text: string }> = [];
  private readonly results: TavilySearchResult[];
  private readonly credits: number;
  private readonly failures: { rateLimit: number; serverError: number; timeout: number };

  constructor(options: MockTavilyOptions = {}) {
    this.results = options.results ?? [];
    this.credits = options.credits ?? 1;
    this.failures = {
      rateLimit: options.failures?.rateLimit ?? 0,
      serverError: options.failures?.serverError ?? 0,
      timeout: options.failures?.timeout ?? 0,
    };
  }

  private failIfScripted(): void {
    if (this.failures.rateLimit > 0) {
      this.failures.rateLimit -= 1;
      throw new Error("tavily: 429 rate limited");
    }
    if (this.failures.serverError > 0) {
      this.failures.serverError -= 1;
      throw new Error("tavily: 503 service unavailable");
    }
    if (this.failures.timeout > 0) {
      this.failures.timeout -= 1;
      throw new Error("tavily: timeout");
    }
  }

  async search(query: string): Promise<TavilySearchResponse> {
    this.queries.push({ kind: "search", text: query });
    this.failIfScripted();
    return { results: this.results, credits: this.credits };
  }

  async extract(urls: string[], query: string): Promise<{ content: string; credits: number }> {
    this.queries.push({ kind: "extract", text: `${urls.join(",")} ${query}` });
    this.failIfScripted();
    return { content: this.results.map((result) => result.content).join("\n"), credits: this.credits };
  }
}

export interface ResearchCacheOptions {
  dbPath: string;
  now?: () => number;
}

export class ResearchCache {
  private readonly db: DatabaseSync;
  private readonly now: () => number;

  constructor(options: ResearchCacheOptions) {
    this.db = new DatabaseSync(options.dbPath);
    this.now = options.now ?? Date.now;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS research_cache (
        key TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        card_json TEXT NOT NULL,
        sources_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        hit_count INTEGER NOT NULL DEFAULT 0,
        credits INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS research_usage (
        user_id TEXT NOT NULL,
        day TEXT NOT NULL,
        credits INTEGER NOT NULL DEFAULT 0,
        calls INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, day)
      );
    `);
  }

  get(key: string): EvidenceCard | null {
    const row = this.db.prepare("SELECT card_json, expires_at, hit_count FROM research_cache WHERE key = ?").get(key) as
      | { card_json: string; expires_at: number; hit_count: number }
      | undefined;
    if (row === undefined) return null;
    if (row.expires_at <= this.now()) {
      this.db.prepare("DELETE FROM research_cache WHERE key = ?").run(key);
      return null;
    }
    this.db.prepare("UPDATE research_cache SET hit_count = hit_count + 1 WHERE key = ?").run(key);
    const card = JSON.parse(row.card_json) as EvidenceCard;
    return { ...card, cached: true };
  }

  put(key: string, card: EvidenceCard, ttlMs: number, credits: number): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO research_cache (key, question, card_json, sources_json, created_at, expires_at, hit_count, credits) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
      )
      .run(key, card.question, JSON.stringify(card), JSON.stringify(card.sources), this.now(), this.now() + ttlMs, credits);
  }

  recordUsage(userId: string, credits: number, calls: number): void {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    this.db
      .prepare(
        "INSERT INTO research_usage (user_id, day, credits, calls) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, day) DO UPDATE SET credits = credits + excluded.credits, calls = calls + excluded.calls",
      )
      .run(userId, day, credits, calls);
  }

  usageToday(userId: string): { credits: number; calls: number } {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    const row = this.db.prepare("SELECT credits, calls FROM research_usage WHERE user_id = ? AND day = ?").get(userId, day) as
      | { credits: number; calls: number }
      | undefined;
    return { credits: row?.credits ?? 0, calls: row?.calls ?? 0 };
  }

  close(): void {
    this.db.close();
  }
}

// ---------------------------------------------------------------------------
// Query building and evidence cards
// ---------------------------------------------------------------------------

export interface BuiltQuery {
  query: string;
  cacheKey: string;
  officialDomains: string[];
}

export function normalizeQuestion(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildQuery(input: ResearchQuery, policy: Policy): BuiltQuery {
  const parts: string[] = [];
  if (input.packageName !== undefined && input.packageName !== "") {
    parts.push(input.packageVersion === undefined ? input.packageName : `${input.packageName} ${input.packageVersion}`);
  }
  parts.push(normalizeQuestion(input.question));
  if (input.errorText !== undefined && input.errorText !== "") {
    parts.push(input.errorText.trim().slice(0, 200));
  }
  const query = parts.join(" ").slice(0, 200);
  const domains = input.officialDomains ?? (input.packageName === undefined ? [] : policy.research.official_domains[input.packageName] ?? []);
  const key = sha256Hex(`${normalizeQuestion(query)}|${input.packageVersion ?? ""}|${PROMPT_VERSION}`);
  return { query, cacheKey: key, officialDomains: domains };
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function firstSentences(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const lastPeriod = cut.lastIndexOf(". ");
  return lastPeriod > 80 ? cut.slice(0, lastPeriod + 1) : `${cut}…`;
}

export function compressToCard(
  results: TavilySearchResult[],
  question: string,
  options: { tokenCap: number; cached: boolean; pkg?: { name: string; version: string }; now?: () => number },
): EvidenceCard {
  const now = options.now ?? Date.now;
  const retrievedAt = new Date(now()).toISOString();
  const sources: EvidenceSource[] = results.map((result) => {
    let domain = "";
    try {
      domain = new URL(result.url).hostname;
    } catch {
      domain = "unknown";
    }
    return { title: result.title, url: result.url, domain, retrievedAt };
  });

  const answer = firstSentences(results[0]?.content ?? "No answer found.", 400);
  const facts: string[] = [];
  for (const result of results) {
    for (const sentence of result.content.split(/(?<=[.!?])\s+/)) {
      const fact = sentence.trim();
      if (fact.length < 20 || fact.length > 180) continue;
      if (facts.some((existing) => existing.toLowerCase() === fact.toLowerCase())) continue;
      facts.push(fact);
      if (facts.length >= 6) break;
    }
    if (facts.length >= 6) break;
  }

  const official = sources.filter((source) => /(^|\.)(docs\.|nodejs\.org|developer\.mozilla\.org|docs\.python\.org|github\.com|npmjs\.com|pypi\.org)/.test(source.domain)).length;
  const confidence: EvidenceCard["confidence"] = official >= 2 ? "high" : official >= 1 ? "medium" : "low";

  const build = (factsToUse: string[]): EvidenceCard => {
    const tokenEstimate = estimateTokens([answer, ...factsToUse, ...sources.map((source) => `${source.title} ${source.url}`)].join(" "));
    return {
      id: `card_${sha256Hex(question).slice(0, 12)}`,
      question,
      answer,
      facts: factsToUse,
      sources,
      confidence,
      ...(options.pkg === undefined ? {} : { package: options.pkg }),
      tokenEstimate,
      cached: options.cached,
    };
  };

  let card = build(facts);
  while (card.tokenEstimate > options.tokenCap && card.facts.length > 0) {
    card = build(card.facts.slice(0, -1));
  }
  return card;
}

// ---------------------------------------------------------------------------
// Scout
// ---------------------------------------------------------------------------

export interface ScoutOptions {
  client: TavilyClient;
  cache: ResearchCache;
  policy: Policy;
  userId: string;
  now?: () => number;
  localLookup?: (query: ResearchQuery) => Promise<string | null>;
}

export interface ScoutState {
  /** Number of research calls made per task id. */
  callsPerTask: Map<string, number>;
}

export function createScout(options: ScoutOptions): ResearchClient & { state: ScoutState; cache: ResearchCache } {
  const state: ScoutState = { callsPerTask: new Map() };
  const now = options.now ?? Date.now;
  const { policy } = options;

  async function research(query: ResearchQuery, researchOptions: { confidential: boolean; cachedOnly?: boolean }): Promise<ResearchOutcome> {
    if (researchOptions.confidential) {
      return { status: "denied", reason: "research is hard-disabled in confidential mode" };
    }
    if (!policy.research.enabled) {
      return { status: "denied", reason: "research disabled by policy" };
    }
    const queryText = [query.question, query.packageName ?? "", query.errorText ?? ""].join(" ");
    if (scanSecrets(queryText).length > 0) {
      return { status: "denied", reason: "query contains secret-like content" };
    }
    if (options.localLookup !== undefined) {
      const local = await options.localLookup(query);
      if (local !== null && local.trim() !== "") return { status: "local_answer", reason: local.trim().slice(0, 300) };
    }

    const built = buildQuery(query, policy);
    const cached = options.cache.get(built.cacheKey);
    if (cached !== null) return { status: "card", card: cached, credits: 0, cached: true };

    if (researchOptions.cachedOnly === true) {
      return { status: "unavailable", reason: "no fresh cached research and only cache is allowed" };
    }

    const callsSoFar = state.callsPerTask.get(query.taskId) ?? 0;
    if (callsSoFar >= policy.budgets.research.calls_per_task) {
      return { status: "denied", reason: `task research cap reached (${policy.budgets.research.calls_per_task} calls)` };
    }
    const usage = options.cache.usageToday(options.userId);
    if (usage.credits >= policy.budgets.research.credits_per_day) {
      return { status: "budget_exhausted", reason: "daily research credit budget exhausted" };
    }

    let response: TavilySearchResponse;
    try {
      response = await options.client.search(built.query, {
        maxResults: 3,
        depth: "basic",
        domains: built.officialDomains,
      });
    } catch {
      return { status: "unavailable", reason: "Tavily unavailable; continue with local knowledge" };
    }
    if (response.results.length === 0) {
      return { status: "unavailable", reason: "Tavily returned no results" };
    }

    state.callsPerTask.set(query.taskId, callsSoFar + 1);
    const card = compressToCard(response.results, query.question, {
      tokenCap: policy.research.card_token_cap,
      cached: false,
      ...(query.packageName === undefined
        ? {}
        : { pkg: { name: query.packageName, version: query.packageVersion ?? "unknown" } }),
      now,
    });
    options.cache.put(built.cacheKey, card, policy.research.ttl_seconds * 1000, response.credits);
    options.cache.recordUsage(options.userId, response.credits, 1);
    return { status: "card", card, credits: response.credits, cached: false };
  }

  return { research, state, cache: options.cache };
}
