/**
 * Bifrost model-plane client.
 *
 * Bifrost is the only path from Gidorah to a model (ADR-0001, ADR-0004). This
 * client speaks OpenAI Chat Completions, sends the policy headers the gateway
 * rules key on, and turns Bifrost's routing response headers and status codes
 * into the structures the agent needs: RoutingInfo, BudgetExceededError, and
 * ProviderError. It never retries: Bifrost owns retries and fallbacks, and 402
 * is never retried anywhere (FR-06).
 */
import {
  BudgetExceededError,
  ProviderError,
} from "../../shared/src/errors.ts";
import type {
  ModelClient,
  ModelRef,
  ModelRequest,
  ModelResponse,
  RoutingInfo,
  StreamChunk,
  TokenUsage,
  ToolCall,
} from "../../shared/src/types.ts";

export interface BifrostClientOptions {
  baseUrl: string;
  virtualKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface RawChoiceMessage {
  content?: string | null;
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
}

interface RawCompletion {
  id?: string;
  choices?: Array<{ message?: RawChoiceMessage; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

function endpoint(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (/\/chat\/completions$/.test(trimmed)) return trimmed;
  if (/\/(v\d+|openai)$/.test(trimmed)) {
    return trimmed.endsWith("/openai") ? `${trimmed}/v1/chat/completions` : `${trimmed}/chat/completions`;
  }
  return `${trimmed}/v1/chat/completions`;
}

export function parseRoutingHeaders(headers: Headers, requested: ModelRef): RoutingInfo {
  const get = (name: string): string => headers.get(name) ?? "";
  const servedProvider = get("x-bifrost-routing-info-provider") || requested.provider;
  const servedModel = get("x-bifrost-routing-info-model") || requested.model;
  const requestedProvider = get("x-bifrost-routing-info-requested-provider") || requested.provider;
  const requestedModel = get("x-bifrost-routing-info-requested-model") || requested.model;
  const fallbackHeader = get("x-bifrost-routing-info-is-fallback");
  const fallbackIndexHeader = get("x-bifrost-fallback-index");
  const primaryProvider = get("x-bifrost-routing-info-primary-provider");
  const primaryModel = get("x-bifrost-routing-info-primary-model");
  const latency = Number.parseFloat(get("x-bifrost-upstream-latency-ms"));
  const served: ModelRef = { provider: servedProvider, model: servedModel };
  const explicitRequested: ModelRef = { provider: requestedProvider, model: requestedModel };
  const differs = served.provider !== explicitRequested.provider || served.model !== explicitRequested.model;
  const fallback = fallbackHeader === "true" || (fallbackHeader === "" && differs && get("x-bifrost-request-type") !== "");
  return {
    requested: explicitRequested,
    served,
    fallback,
    ...(fallbackIndexHeader !== "" ? { fallbackIndex: Number.parseInt(fallbackIndexHeader, 10) } : {}),
    ...(primaryProvider !== "" ? { primary: { provider: primaryProvider, model: primaryModel } } : {}),
    cacheHit: get("x-bifrost-cache-hit") === "true",
    latencyMs: Number.isFinite(latency) ? latency : 0,
  };
}

function normalizeUsage(raw: RawCompletion["usage"]): TokenUsage {
  const input = raw?.prompt_tokens ?? 0;
  const output = raw?.completion_tokens ?? 0;
  return { input, output, cacheRead: 0, cacheWrite: 0, total: raw?.total_tokens ?? input + output };
}

function parseToolCalls(message: RawChoiceMessage | undefined): ToolCall[] {
  const calls = message?.tool_calls ?? [];
  return calls.map((call) => {
    let args: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(call.function.arguments) as unknown;
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
    } catch {
      args = { _raw: call.function.arguments };
    }
    return { id: call.id, name: call.function.name, arguments: args };
  });
}

async function mapErrorStatus(status: number, text: string): Promise<never> {
  let parsed: { error?: { type?: string; message?: string }; type?: string; message?: string } = {};
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    // non-JSON error body
  }
  const type = parsed.error?.type ?? parsed.type ?? "";
  const message = parsed.error?.message ?? parsed.message ?? text.slice(0, 300);
  if (status === 402 || type === "budget_exceeded") {
    throw new BudgetExceededError(`Bifrost budget exceeded: ${message}`, { status, type });
  }
  const retryable = status === 429 || status === 502 || status === 503 || status === 504 || status >= 500;
  throw new ProviderError(`Bifrost upstream error ${status}: ${message}`, { status, retryable });
}

function requestBody(request: ModelRequest, stream: boolean): string {
  const messages = request.messages.map((message) => {
    if (message.role === "tool") return { role: "tool", content: message.content, tool_call_id: message.toolCallId ?? "" };
    if (message.role === "assistant" && message.toolCalls !== undefined && message.toolCalls.length > 0) {
      return {
        role: "assistant",
        content: message.content,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.arguments) },
        })),
      };
    }
    return { role: message.role, content: message.content };
  });
  return JSON.stringify({
    model: request.modelAlias,
    messages,
    stream,
    ...(request.maxTokens === undefined ? {} : { max_tokens: request.maxTokens }),
    ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
    ...(request.tools === undefined ? {} : { tools: request.tools, tool_choice: "auto" }),
  });
}

function headersFor(request: ModelRequest, virtualKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${virtualKey}`,
    "x-bf-vk": virtualKey,
    "x-gidorah-phase": request.phase,
    "x-gidorah-confidential": request.confidential ? "true" : "false",
    "x-bf-session-id": request.sessionId,
  };
  if (request.cacheKey !== undefined) headers["x-bf-cache-key"] = request.cacheKey;
  return headers;
}

export function createBifrostClient(options: BifrostClientOptions): ModelClient {
  const doFetch = options.fetchImpl ?? fetch;
  const url = endpoint(options.baseUrl);

  async function complete(request: ModelRequest, signal?: AbortSignal): Promise<ModelResponse> {
    const timeout = AbortSignal.timeout(options.timeoutMs ?? 60_000);
    const combined = signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
    let response: Response;
    try {
      response = await doFetch(url, {
        method: "POST",
        headers: headersFor(request, options.virtualKey),
        body: requestBody(request, false),
        signal: combined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ProviderError(`Bifrost unreachable: ${message}`, { retryable: true });
    }
    if (!response.ok) await mapErrorStatus(response.status, await response.text());
    const raw = (await response.json()) as RawCompletion;
    const requested: ModelRef = { provider: "requested", model: request.modelAlias };
    const routing = parseRoutingHeaders(response.headers, requested);
    const choice = raw.choices?.[0];
    return {
      id: raw.id ?? "completion",
      content: choice?.message?.content ?? "",
      toolCalls: parseToolCalls(choice?.message),
      usage: normalizeUsage(raw.usage),
      routing,
      finishReason: choice?.finish_reason ?? "stop",
    };
  }

  async function* stream(request: ModelRequest, signal?: AbortSignal): AsyncIterable<StreamChunk> {
    const timeout = AbortSignal.timeout(options.timeoutMs ?? 120_000);
    const combined = signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
    const response = await doFetch(url, {
      method: "POST",
      headers: headersFor(request, options.virtualKey),
      body: requestBody(request, true),
      signal: combined,
    });
    if (!response.ok) {
      const body = await response.text();
      try {
        await mapErrorStatus(response.status, body);
      } catch (error) {
        if (error instanceof BudgetExceededError) {
          yield { type: "error", error: { code: error.code, message: error.message, retryable: false } };
          return;
        }
        if (error instanceof ProviderError) {
          yield { type: "error", error: { code: error.code, message: error.message, retryable: error.retryable } };
          return;
        }
        throw error;
      }
    }
    const requested: ModelRef = { provider: "requested", model: request.modelAlias };
    const routing = parseRoutingHeaders(response.headers, requested);
    const reader = response.body?.getReader();
    if (reader === undefined) throw new ProviderError("Streaming response had no body", { status: 0 });
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    const toolCalls = new Map<number, { id: string; name: string; args: string }>();
    let usage: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
    let finishReason = "stop";
    let finished = false;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            finished = true;
            continue;
          }
          let chunk: {
            choices?: Array<{
              delta?: { content?: string; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> };
              finish_reason?: string;
            }>;
            usage?: RawCompletion["usage"];
          };
          try {
            chunk = JSON.parse(payload) as typeof chunk;
          } catch {
            continue;
          }
          if (chunk.usage !== undefined) usage = normalizeUsage(chunk.usage);
          const choice = chunk.choices?.[0];
          if (choice?.delta?.content !== undefined && choice.delta.content !== "") {
            content += choice.delta.content;
            yield { type: "delta", text: choice.delta.content };
          }
          for (const call of choice?.delta?.tool_calls ?? []) {
            const existing = toolCalls.get(call.index) ?? { id: "", name: "", args: "" };
            if (call.id !== undefined) existing.id = call.id;
            if (call.function?.name !== undefined) existing.name = call.function.name;
            if (call.function?.arguments !== undefined) existing.args += call.function.arguments;
            toolCalls.set(call.index, existing);
          }
          if (choice?.finish_reason !== undefined && choice.finish_reason !== null) finishReason = choice.finish_reason;
        }
        boundary = buffer.indexOf("\n\n");
      }
      if (finished) {
        await reader.cancel();
        break;
      }
    }

    const parsedCalls: ToolCall[] = [...toolCalls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, call]) => {
        let args: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(call.args) as unknown;
          if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
        } catch {
          args = { _raw: call.args };
        }
        return { id: call.id === "" ? `call_${index}` : call.id, name: call.name, arguments: args };
      });

    yield {
      type: "done",
      response: {
        id: `stream_${Date.now()}`,
        content,
        toolCalls: parsedCalls,
        usage,
        routing,
        finishReason,
      },
    };
  }

  return { complete, stream };
}
