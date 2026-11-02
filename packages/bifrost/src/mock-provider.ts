/**
 * Deterministic mock OpenAI-compatible upstream.
 *
 * Used by every offline gate in place of DeepSeek and Ollama (overnight key
 * policy: no real keys, no network). It records every request body so the red
 * team can scan outbound bytes for the canary, and it can script content, tool
 * calls, usage, failures, and streaming.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { ToolCall } from "../../shared/src/types.ts";

export interface MockScriptStep {
  content?: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  usage?: { input?: number; output?: number };
  /** Force an HTTP failure for this step instead of a completion. */
  status?: number;
  delayMs?: number;
}

export interface RecordedRequest {
  at: number;
  path: string;
  headers: Record<string, string>;
  body: string;
}

export interface MockProvider {
  url: string;
  port: number;
  requests: RecordedRequest[];
  calls(): number;
  setScript(script: MockScriptStep[]): void;
  close(): Promise<void>;
}

export interface MockProviderOptions {
  script?: MockScriptStep[];
  /** Name recorded in responses and request logs, e.g. "mock-deepseek". */
  name?: string;
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, status: number, payload: unknown, extraHeaders: Record<string, string> = {}): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body), ...extraHeaders });
  response.end(body);
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function toolCallsFor(step: MockScriptStep): ToolCall[] {
  return (step.toolCalls ?? []).map((call, index) => ({
    id: `call_${index + 1}`,
    name: call.name,
    arguments: call.arguments,
  }));
}

export async function startMockProvider(options: MockProviderOptions = {}): Promise<MockProvider> {
  let script: MockScriptStep[] = options.script ?? [{ content: "mock provider ready" }];
  let callCount = 0;
  const requests: RecordedRequest[] = [];
  const name = options.name ?? "mock-provider";

  const server = createServer((request, response) => {
    void (async () => {
      const body = await readBody(request);
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value === "string") headers[key] = value;
        else if (Array.isArray(value)) headers[key] = value.join(",");
      }
      requests.push({ at: Date.now(), path: request.url ?? "/", headers, body });
      const index = Math.min(callCount, Math.max(0, script.length - 1));
      callCount += 1;
      const step = script[index] ?? { content: "mock provider ready" };

      if (step.delayMs !== undefined && step.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, step.delayMs));
      }
      if (step.status !== undefined && step.status >= 400) {
        sendJson(
          response,
          step.status,
          { error: { type: step.status === 402 ? "budget_exceeded" : "upstream_error", message: `mock ${step.status}` } },
          { "x-mock-provider": name },
        );
        return;
      }

      let parsed: { stream?: boolean; messages?: Array<{ content?: string }> } = {};
      try {
        parsed = JSON.parse(body) as typeof parsed;
      } catch {
        // keep defaults
      }
      const promptText = (parsed.messages ?? []).map((message) => message.content ?? "").join("\n");
      const toolCalls = toolCallsFor(step);
      const content = step.content ?? "";
      const usage = {
        prompt_tokens: step.usage?.input ?? estimateTokens(promptText),
        completion_tokens: step.usage?.output ?? estimateTokens(content + JSON.stringify(toolCalls)),
        total_tokens: 0,
      };
      usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;

      if (parsed.stream === true) {
        response.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
          "x-mock-provider": name,
        });
        const send = (payload: unknown): void => {
          response.write(`data: ${JSON.stringify(payload)}\n\n`);
        };
        send({ id: "mock_stream", choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] });
        for (const piece of content.match(/[\s\S]{1,24}/g) ?? []) {
          send({ id: "mock_stream", choices: [{ index: 0, delta: { content: piece }, finish_reason: null }] });
        }
        toolCalls.forEach((call, callIndex) => {
          send({
            id: "mock_stream",
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [
                    {
                      index: callIndex,
                      id: call.id,
                      type: "function",
                      function: { name: call.name, arguments: JSON.stringify(call.arguments) },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          });
        });
        send({
          id: "mock_stream",
          choices: [{ index: 0, delta: {}, finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop" }],
          usage,
        });
        response.write("data: [DONE]\n\n");
        response.end();
        return;
      }

      sendJson(
        response,
        200,
        {
          id: "mock_completion",
          object: "chat.completion",
          model: name,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content,
                ...(toolCalls.length > 0
                  ? {
                      tool_calls: toolCalls.map((call) => ({
                        id: call.id,
                        type: "function",
                        function: { name: call.name, arguments: JSON.stringify(call.arguments) },
                      })),
                    }
                  : {}),
              },
              finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
            },
          ],
          usage,
        },
        { "x-mock-provider": name },
      );
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
    requests,
    calls: () => callCount,
    setScript: (next: MockScriptStep[]) => {
      script = next;
    },
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
