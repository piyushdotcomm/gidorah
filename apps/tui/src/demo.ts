/**
 * Scripted, deterministic TUI demo (`gidorah tui --demo`).
 *
 * Uses a fake streaming model and a fake research client, so it is offline and
 * repeatable. It prints frames rather than driving a real terminal.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TuiApp, type TuiHooks } from "./app.ts";
import { Session } from "../../../packages/core/src/session.ts";
import { BudgetService } from "../../../packages/core/src/runtime.ts";
import { createDefaultTools, runProcess } from "../../../packages/core/src/tools.ts";
import { classifyToolCall } from "../../../packages/policy/src/approval.ts";
import { classifyRepo } from "../../../packages/policy/src/classify.ts";
import { DEFAULT_POLICY } from "../../../packages/policy/src/schema.ts";
import type { EvidenceCard, ModelClient, ModelResponse, ResearchClient, ToolCall } from "../../../packages/shared/src/types.ts";

interface Step {
  content: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  fallback?: boolean;
}

function response(step: Step, index: number): ModelResponse {
  const toolCalls: ToolCall[] = (step.toolCalls ?? []).map((call, callIndex) => ({ id: `demo_${index}_${callIndex}`, name: call.name, arguments: call.arguments }));
  return {
    id: `demo_${index}`,
    content: step.content,
    toolCalls,
    usage: { input: 420, output: 80, cacheRead: index === 3 ? 160 : 0, cacheWrite: 0, total: 500 },
    routing: {
      requested: { provider: "fireworks", model: "deepseek-v4p1-flash" },
      served: { provider: "fireworks", model: step.fallback === true ? "glm-5p3-flash" : "deepseek-v4p1-flash" },
      fallback: step.fallback === true,
      ...(step.fallback === true ? { fallbackIndex: 1, primary: { provider: "fireworks", model: "deepseek-v4p1-flash" } } : {}),
      cacheHit: index === 3,
      latencyMs: 180,
    },
    finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
  };
}

function fakeResearch(): ResearchClient {
  const card: EvidenceCard = {
    id: "card_demo",
    question: "How do I compose abort signals in current Node?",
    answer: "AbortSignal.any(signals) returns a signal that aborts when any input signal aborts.",
    facts: ["Available in current Node.", "The composed signal aborts with the first reason."],
    sources: [{ title: "Node.js docs: AbortSignal.any()", url: "https://nodejs.org/api/globals.html#abortsignalany", domain: "nodejs.org", retrievedAt: "2026-11-03" }],
    confidence: "high",
    tokenEstimate: 180,
    cached: false,
  };
  return {
    async research() {
      return { status: "card" as const, card, credits: 1, cached: false };
    },
  };
}

export async function renderTuiDemo(): Promise<string> {
  const lines: string[] = [];
  await runTuiDemo((line) => lines.push(line));
  return lines.join("\n");
}

export async function runTuiDemo(write: (line: string) => void = (line) => process.stdout.write(`${line}\n`)): Promise<number> {
  const root = mkdtempSync(join(tmpdir(), "gidorah-tui-demo-"));
  writeFileSync(join(root, "greeting.txt"), "hello\n", "utf8");
  const session = Session.create({ dir: join(root, ".sessions"), cwd: root, user: "demo", mode: "cloud", policyVersion: "1" });
  const policy = DEFAULT_POLICY;
  const classification = classifyRepo(policy, root);
  const budget = new BudgetService(1, 1);
  const research = fakeResearch();
  const steps: Step[] = [
    { content: "I'll patch greeting.txt so the check passes.", toolCalls: [{ name: "edit", arguments: { path: "greeting.txt", find: "hello", replace: "hello, world" } }] },
    { content: "The patch is in. I'll run the shell check.", toolCalls: [{ name: "bash", arguments: { command: "npm test -- --watch" } }] },
    { content: "Let me check the current Node docs before using AbortSignal.", toolCalls: [{ name: "research", arguments: { question: "How do I compose abort signals in current Node?" } }] },
    { content: "Done. greeting.txt is updated and the docs card is attached.", fallback: true, toolCalls: [] },
  ];
  let index = 0;
  const next = (): Step => steps[Math.min(index, steps.length - 1)]!;
  const model: ModelClient = {
    async complete(): Promise<ModelResponse> {
      const step = next();
      index += 1;
      return response(step, index);
    },
    async *stream(): AsyncIterable<{ type: "delta"; text: string } | { type: "done"; response: ModelResponse }> {
      const step = next();
      index += 1;
      const final = response(step, index);
      for (const piece of final.content.match(/[\s\S]{1,12}/g) ?? []) {
        yield { type: "delta", text: piece };
        await new Promise((resolve) => setTimeout(resolve, 12));
      }
      yield { type: "done", response: final };
    },
  };
  const io = { stdin: { isTTY: false }, stdout: { isTTY: false, columns: 100, rows: 34, write: () => true, on: () => undefined } };
  const app = new TuiApp({
    session,
    createDeps: (_target: Session, hooks: TuiHooks) => ({
      model,
      tools: createDefaultTools(),
      approval: hooks.approval,
      budget,
      policy,
      repoClass: classification.mode,
      workspaceRoot: root,
      run: runProcess,
      estimateCost: () => 0.0004,
      classifyTool: (tool: string, args: Record<string, unknown>) => classifyToolCall(tool, args, { policy, classification, cwd: root, workspaceRoot: root }),
      research,
      ...(hooks.onModelDelta === undefined ? {} : { onModelDelta: hooks.onModelDelta }),
      ...(hooks.modelAlias === undefined ? {} : { modelAlias: hooks.modelAlias }),
    }),
    createSession: () => Session.create({ dir: join(root, ".sessions"), cwd: root, user: "demo", mode: "cloud", policyVersion: "1" }),
    listSessions: () => [{ id: session.header.sessionId, label: `${session.header.sessionId} · write a demo file and verify the runtime` }],
    loadSession: () => session,
    budgetSnapshot: () => budget.snapshot(),
    cwd: root.replaceAll("\\", "/"),
    branch: "main",
    mode: "mock",
    modelAlias: "gidorah-auto",
    availableAliases: ["gidorah-auto", "fireworks/accounts/fireworks/models/deepseek-v4p1-flash"],
    color: false,
    width: 100,
    height: 34,
  });
  const frame = (title: string): void => {
    write("");
    write(`### ${title}`);
    write("```text");
    write(app.snapshot(100, 34));
    write("```");
  };
  const waitFor = async (check: () => boolean, label: string): Promise<void> => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (check()) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`demo timeout: ${label}`);
  };

  write("# Gidorah native TUI demo");
  write("");
  write("Deterministic, offline (`gidorah tui --demo`). The model is a fake streaming model; the research card is fake; no provider or Tavily call is made.");
  const turn = app.submit("patch greeting.txt and verify the runtime");
  await waitFor(() => app.transcript().some((item) => item.kind === "assistant" && item.streaming === true), "streaming");
  frame("1. Streaming assistant text + tool card");
  await waitFor(() => app.pendingApproval(), "edit approval");
  frame("2. Edit approval with path and numbered diff");
  app.respond("allow");
  await waitFor(() => app.pendingApproval(), "bash approval");
  frame("3. Shell approval hint (read-only/mutating)");
  app.respond("deny");
  await waitFor(() => app.transcript().some((item) => item.kind === "research"), "research card");
  frame("4. Research card and denied shell tool");
  await turn;
  frame("5. Turn complete: takeover banner, receipt");
  await app.submit("/status");
  await app.submit("/trace");
  await app.submit("/receipt");
  frame("6. /status, /trace, /receipt");
  await app.submit("/resume");
  frame("7. /resume picker (arrow keys or number, Esc cancels)");
  app.handleKey(undefined, { name: "escape" });
  await app.submit("/model");
  frame("8. /model aliases");
  await app.submit("/quit");
  write("");
  write("Demo finished. Run `node apps/cli/src/main.ts tui` for the real interactive session.");
  rmSync(root, { recursive: true, force: true });
  return 0;
}
