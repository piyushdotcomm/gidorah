/**
 * Real Tavily HTTP client (docs/01-architecture/tavily-knowledge-plane.md §5).
 *
 * Used when TAVILY_API_KEY is present. The mock client stays for tests. Search
 * uses the cheap depth ladder and never fetches raw page content; extract is
 * limited to the top URLs and reranks chunks with the question.
 */
import type { SearchDepth, TavilyClient, TavilySearchResponse } from "./scout.ts";

export interface TavilyHttpClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface TavilyRawResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

export function createTavilyClient(options: TavilyHttpClientOptions): TavilyClient {
  const doFetch = options.fetchImpl ?? fetch;
  const base = (options.baseUrl ?? "https://api.tavily.com").replace(/\/+$/, "");

  async function post(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const timeout = AbortSignal.timeout(options.timeoutMs ?? 20_000);
    const response = await doFetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${options.apiKey}` },
      body: JSON.stringify(body),
      signal: timeout,
    });
    if (!response.ok) throw new Error(`Tavily ${path} failed: HTTP ${response.status}`);
    return (await response.json()) as Record<string, unknown>;
  }

  return {
    async search(query: string, searchOptions: { maxResults: number; depth: SearchDepth; domains?: string[] }): Promise<TavilySearchResponse> {
      const payload = await post("/search", {
        query,
        max_results: searchOptions.maxResults,
        search_depth: searchOptions.depth === "ultra-fast" ? "fast" : searchOptions.depth,
        chunks_per_source: 2,
        include_answer: false,
        include_raw_content: false,
        include_domains: searchOptions.domains ?? [],
      });
      const results = ((payload.results ?? []) as TavilyRawResult[]).map((result) => ({
        title: result.title ?? "untitled",
        url: result.url ?? "",
        content: result.content ?? "",
        score: result.score ?? 0,
      }));
      const usage = payload.usage as { credits?: number } | undefined;
      return { results, credits: usage?.credits ?? 1 };
    },

    async extract(urls: string[], query: string): Promise<{ content: string; credits: number }> {
      const payload = await post("/extract", {
        urls,
        query,
        chunks_per_source: 2,
        extract_depth: "basic",
        format: "markdown",
        include_usage: true,
      });
      const results = (payload.results ?? []) as Array<{ raw_content?: string; content?: string }>;
      const content = results.map((result) => result.raw_content ?? result.content ?? "").join("\n");
      const usage = payload.usage as { credits?: number } | undefined;
      return { content, credits: usage?.credits ?? 0 };
    },
  };
}
