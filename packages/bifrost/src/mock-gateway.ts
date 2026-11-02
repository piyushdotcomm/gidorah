/**
 * Mock Bifrost gateway.
 *
 * Real Bifrost is not installable or runnable on this machine (no network, no
 * binary), so the policy behaviors that Bifrost owns are implemented here for
 * offline testing: virtual-key auth and provider allowlists, pre-request
 * budgets with 402, phase routing and aliases, cross-provider fallbacks with
 * routing headers, DLP/policy plugin behavior, confidential guard, and
 * request logs. This is a TEST DOUBLE, never a production path. The real
 * gateway is PENDING per MORNING_RUNBOOK.md.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Phase } from "../../shared/src/types.ts";
import { inspectOutbound, violatesConfidentialGuard } from "./dlp.ts";

export interface MockVirtualKey {
  name: string;
  kind: "cloud" | "local";
  providers: string[];
  budgetUsd: number;
  usedUsd: number;
}

export interface MockGatewayRouting {
  /** alias -> "provider/model" */
  aliases: Record<string, string>;
  /** phase -> "provider/model" */
  phases: Record<Phase, string>;
  /** "provider/model" -> ordered fallbacks */
  fallbacks: Record<string, string[]>;
}

export interface GatewayLogEntry {
  requestId: string;
  at: number;
  sessionId: string;
  vk: string;
  phase: string;
  requestedAlias: string;
  requested: { provider: string; model: string };
  served: { provider: string; model: string };
  fallback: boolean;
  fallbackIndex: number;
  confidential: boolean;
  status: number;
  tokens: { input: number; output: number; total: number };
  costUsd: number;
  latencyMs: number;
  dlp?: { action: "clean" | "blocked" | "redacted"; class?: string };
}

export interface MockGatewayOptions {
  upstreams: { deepseek: string; ollama: string };
  virtualKeys: MockVirtualKey[];
  routing: MockGatewayRouting;
  dlp?: { enabled?: boolean; defaultAction?: "block" | "redact" };
  /** Synthesize upstream failures before forwarding: model id -> remaining failure count. */
  failures?: Record<string, number>;
}

export interface MockGateway {
  url: string;
  port: number;
  logs: GatewayLogEntry[];
  close(): Promise<void>;
  key(name: string): MockVirtualKey | undefined;
}

export const MODEL_COST_PER_1K: Record<string, { input: number; output: number }> = {
  "deepseek-flash": { input: 0.00014, output: 0.00028 },
  "deepseek-pro": { input: 0.00055, output: 0.00219 },
  "qwen2.5-coder:3b": { input: 0, output: 0 },
};

export function costFor(model: string, usage: { input: number; output: number }): number {
  const price = MODEL_COST_PER_1K[model] ?? { input: 0.0002, output: 0.0004 };
  return (usage.input / 1000) * price.input + (usage.output / 1000) * price.output;
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, status: number, payload: unknown, extra: Record<string, string> = {}): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body), ...extra });
  response.end(body);
}

function parseTarget(target: string): { provider: string; model: string } {
  const slash = target.indexOf("/");
  if (slash === -1) return { provider: "deepseek", model: target };
  return { provider: target.slice(0, slash), model: target.slice(slash + 1) };
}

function estimate(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export async function startMockGateway(options: MockGatewayOptions): Promise<MockGateway> {
  const logs: GatewayLogEntry[] = [];
  const failures: Record<string, number> = { ...(options.failures ?? {}) };
  // Conservative admission reservation: the mock gateway serializes budget
  // admission synchronously, standing in for Bifrost's atomic pre-request check.
  const reserved = new Map<string, number>();
  const RESERVATION_USD = 0.0005;
  const dlpEnabled = options.dlp?.enabled ?? true;
  const dlpAction = options.dlp?.defaultAction ?? "block";

  const server = createServer((request, response) => {
    void (async () => {
      const body = await readBody(request);
      const url = request.url ?? "/";

      if (request.method === "GET" && url.startsWith("/api/logs")) {
        sendJson(response, 200, { logs });
        return;
      }

      const vkName = (request.headers["x-bf-vk"] as string | undefined) ??
        ((request.headers.authorization as string | undefined) ?? "").replace(/^Bearer\s+/i, "");
      const vk = options.virtualKeys.find((candidate) => candidate.name === vkName);
      if (vk === undefined) {
        sendJson(response, 401, { error: { type: "invalid_virtual_key", message: "unknown virtual key" } });
        return;
      }

      const confidential = String(request.headers["x-gidorah-confidential"] ?? "false") === "true";
      const phase = String(request.headers["x-gidorah-phase"] ?? "other") as Phase;
      const sessionId = String(request.headers["x-bf-session-id"] ?? "unknown");
      const requestId = `req_${logs.length + 1}`;

      let parsed: { model?: string; messages?: Array<{ content?: string }>; stream?: boolean } = {};
      try {
        parsed = JSON.parse(body) as typeof parsed;
      } catch {
        sendJson(response, 400, { error: { type: "invalid_request", message: "body is not JSON" } });
        return;
      }

      // DLP / policy plugin (TypeScript twin of the Go plugin).
      let forwardBody = body;
      let dlpHeader = "clean";
      let dlpClass: string | undefined;
      if (dlpEnabled) {
        const decision = inspectOutbound(body, { confidential, defaultAction: dlpAction });
        if (decision.action === "blocked") {
          dlpHeader = `blocked:${decision.classes[0] ?? "secret"}`;
          dlpClass = decision.classes[0];
          logs.push({
            requestId,
            at: Date.now(),
            sessionId,
            vk: vk.name,
            phase,
            requestedAlias: parsed.model ?? "unknown",
            requested: { provider: "unknown", model: parsed.model ?? "unknown" },
            served: { provider: "none", model: "none" },
            fallback: false,
            fallbackIndex: 0,
            confidential,
            status: 451,
            tokens: { input: 0, output: 0, total: 0 },
            costUsd: 0,
            latencyMs: 0,
            dlp: { action: "blocked", ...(dlpClass === undefined ? {} : { class: dlpClass }) },
          });
          sendJson(
            response,
            451,
            { error: { type: "dlp_blocked", message: "request blocked by DLP before egress", class: dlpClass ?? "secret" } },
            { "x-gidorah-dlp": dlpHeader, "x-gidorah-policy": confidential ? "confidential-local-only" : "standard", "x-gidorah-policy-version": "1" },
          );
          return;
        }
        if (decision.action === "redacted") {
          forwardBody = decision.body;
          dlpHeader = `redacted:${decision.classes[0] ?? "secret"}`;
          dlpClass = decision.classes[0];
        }
      }

      if (confidential && vk.kind !== "local") {
        sendJson(
          response,
          403,
          { error: { type: "confidential_violation", message: "confidential request requires the local-only virtual key" } },
          { "x-gidorah-policy": "confidential-local-only", "x-gidorah-dlp": dlpHeader },
        );
        return;
      }

      // The local-only key carries no dollar budget (bifrost-model-plane.md Â§4).
      if (vk.kind !== "local" && vk.usedUsd + (reserved.get(vk.name) ?? 0) >= vk.budgetUsd) {
        sendJson(
          response,
          402,
          { error: { type: "budget_exceeded", message: `budget exhausted for ${vk.name}`, holder: vk.name } },
          { "x-gidorah-policy": confidential ? "confidential-local-only" : "standard", "x-gidorah-dlp": dlpHeader },
        );
        return;
      }

      if (vk.kind !== "local") reserved.set(vk.name, (reserved.get(vk.name) ?? 0) + RESERVATION_USD);
      const requestedAlias = parsed.model ?? "gidorah-auto";
      let primary: { provider: string; model: string };
      const aliasTarget = options.routing.aliases[requestedAlias];
      if (requestedAlias === "gidorah-auto") {
        primary = parseTarget(options.routing.phases[phase] ?? options.routing.phases.other ?? "deepseek/deepseek-flash");
      } else if (aliasTarget !== undefined) {
        primary = parseTarget(aliasTarget);
      } else {
        primary = parseTarget(requestedAlias);
      }

      if (!vk.providers.includes(primary.provider) && !(confidential && primary.provider === "ollama" && vk.providers.includes("ollama"))) {
        sendJson(
          response,
          403,
          {
            error: {
              type: "provider_not_allowed",
              message: `virtual key ${vk.name} may not use provider ${primary.provider}`,
            },
          },
          { "x-gidorah-policy": confidential ? "confidential-local-only" : "standard", "x-gidorah-dlp": dlpHeader },
        );
        return;
      }
      if (confidential && violatesConfidentialGuard(true, primary.provider)) {
        sendJson(
          response,
          403,
          { error: { type: "confidential_violation", message: "confidential request may not reach a cloud provider" } },
          { "x-gidorah-policy": "confidential-local-only", "x-gidorah-dlp": dlpHeader },
        );
        return;
      }

      const chain = [primary, ...(options.routing.fallbacks[`${primary.provider}/${primary.model}`] ?? []).map(parseTarget)];
      const startedAt = Date.now();
      let served = primary;
      let fallbackIndex = 0;
      let upstreamResponse: Response | null = null;
      let lastStatus = 0;
      let lastBody = "";

      for (let index = 0; index < chain.length; index += 1) {
        const target = chain[index]!;
        served = target;
        fallbackIndex = index;
        const key = target.model;
        const syntheticFailure = failures[key] ?? 0;
        if (syntheticFailure > 0) {
          failures[key] = syntheticFailure - 1;
          lastStatus = 429;
          lastBody = JSON.stringify({ error: { type: "rate_limit", message: "synthetic 429 from mock gateway" } });
          continue;
        }
        const upstreamBase = target.provider === "ollama" ? options.upstreams.ollama : options.upstreams.deepseek;
        const forward = { ...(JSON.parse(forwardBody) as Record<string, unknown>), model: target.model };
        try {
          upstreamResponse = await fetch(`${upstreamBase}/v1/chat/completions`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-mock-target": target.model },
            body: JSON.stringify(forward),
          });
        } catch {
          lastStatus = 502;
          lastBody = JSON.stringify({ error: { type: "upstream_unreachable", message: "upstream unreachable" } });
          continue;
        }
        lastStatus = upstreamResponse.status;
        if (upstreamResponse.ok) break;
        lastBody = await upstreamResponse.text();
        if (![429, 500, 502, 503, 504].includes(upstreamResponse.status)) break;
      }

      const fallback = fallbackIndex > 0;
      const routingHeaders: Record<string, string> = {
        "x-bifrost-routing-info-provider": served.provider,
        "x-bifrost-routing-info-model": served.model,
        "x-bifrost-routing-info-requested-provider": primary.provider,
        "x-bifrost-routing-info-requested-model": primary.model,
        "x-bifrost-routing-info-is-fallback": fallback ? "true" : "false",
        "x-bifrost-routing-info-primary-provider": primary.provider,
        "x-bifrost-routing-info-primary-model": primary.model,
        "x-bifrost-fallback-index": String(fallbackIndex),
        "x-bifrost-upstream-latency-ms": String(Date.now() - startedAt),
        "x-bifrost-request-type": parsed.stream === true ? "stream" : "chat",
        "x-gidorah-policy": confidential ? "confidential-local-only" : "standard",
        "x-gidorah-policy-version": "1",
        "x-gidorah-dlp": dlpHeader,
      };

      const promptText = (parsed.messages ?? []).map((message) => message.content ?? "").join("\n");
      const usage = { input: estimate(promptText), output: 0, total: 0 };

      if (upstreamResponse === null || !upstreamResponse.ok) {
        const status = lastStatus === 0 ? 502 : lastStatus;
        logs.push({
          requestId,
          at: Date.now(),
          sessionId,
          vk: vk.name,
          phase,
          requestedAlias,
          requested: primary,
          served,
          fallback,
          fallbackIndex,
          confidential,
          status,
          tokens: { input: usage.input, output: 0, total: usage.input },
          costUsd: costFor(served.model, { input: usage.input, output: 0 }),
          latencyMs: Date.now() - startedAt,
          dlp: { action: dlpHeader.startsWith("clean") ? "clean" : dlpHeader.startsWith("redacted") ? "redacted" : "blocked", ...(dlpClass === undefined ? {} : { class: dlpClass }) },
        });
        sendJson(response, status, lastBody === "" ? { error: { type: "upstream_error", message: "all upstreams failed" } } : JSON.parse(lastBody), routingHeaders);
        return;
      }

      if (parsed.stream === true) {
        response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", ...routingHeaders });
        const reader = upstreamResponse.body?.getReader();
        const decoder = new TextDecoder();
        let text = "";
        if (reader !== undefined) {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const piece = decoder.decode(value, { stream: true });
            text += piece;
            response.write(piece);
          }
        }
        response.end();
        const output = estimate(text);
        const cost = costFor(served.model, { input: usage.input, output });
        vk.usedUsd += cost;
        logs.push({
          requestId,
          at: Date.now(),
          sessionId,
          vk: vk.name,
          phase,
          requestedAlias,
          requested: primary,
          served,
          fallback,
          fallbackIndex,
          confidential,
          status: 200,
          tokens: { input: usage.input, output, total: usage.input + output },
          costUsd: cost,
          latencyMs: Date.now() - startedAt,
          dlp: { action: dlpHeader.startsWith("clean") ? "clean" : "redacted" },
        });
        return;
      }

      const responseText = await upstreamResponse.text();
      let parsedResponse: { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } } = {};
      try {
        parsedResponse = JSON.parse(responseText) as typeof parsedResponse;
      } catch {
        sendJson(response, 502, { error: { type: "bad_upstream_response", message: "upstream returned non-JSON" } }, routingHeaders);
        return;
      }
      const input = parsedResponse.usage?.prompt_tokens ?? usage.input;
      const output = parsedResponse.usage?.completion_tokens ?? estimate(responseText);
      const cost = costFor(served.model, { input, output });
      vk.usedUsd += cost;
      logs.push({
        requestId,
        at: Date.now(),
        sessionId,
        vk: vk.name,
        phase,
        requestedAlias,
        requested: primary,
        served,
        fallback,
        fallbackIndex,
        confidential,
        status: 200,
        tokens: { input, output, total: input + output },
        costUsd: cost,
        latencyMs: Date.now() - startedAt,
        dlp: { action: dlpHeader.startsWith("clean") ? "clean" : dlpHeader.startsWith("redacted") ? "redacted" : "blocked", ...(dlpClass === undefined ? {} : { class: dlpClass }) },
      });
      response.writeHead(200, { "content-type": "application/json", ...routingHeaders });
      response.end(responseText);
    })();
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    logs,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
    key: (name: string) => options.virtualKeys.find((candidate) => candidate.name === name),
  };
}
