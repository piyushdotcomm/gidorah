/**
 * Agent runtime: turn/step loop, approvals, budget enforcement, route notices,
 * flight recorder, and task receipt (agent-runtime.md, observability doc).
 *
 * The runtime never decides provider or key: it asks the policy plane, sends
 * every model call through the injected Bifrost client, and honors denials.
 */
import { BudgetExceededError, ProviderError } from "../../shared/src/errors.ts";
import { appendJsonl } from "../../shared/src/jsonl.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkDocsGuard } from "./docsguard.ts";
import type { ApiFactSheet } from "./docsguard.ts";
import { redactSecrets } from "../../shared/src/redaction.ts";
import type {
  ApprovalVerdict,
  ModelClient,
  ModelRequest,
  Policy,
  Receipt,
  RepoClass,
  SessionEvent,
  TokenUsage,
  ToolCall,
  ToolResult,
  TraceRecord,
} from "../../shared/src/types.ts";
import { buildContext } from "./context.ts";
import type { CommandResult, RunOptions, ToolContext, ToolRegistry } from "./tools.ts";
import { Session } from "./session.ts";

export interface ApprovalRequest {
  callId: string;
  tool: string;
  risk: string;
  preview: string;
  reason: string;
}

export interface ApprovalService {
  ask(request: ApprovalRequest): Promise<"allow" | "deny">;
}

export class AutoApprovalService implements ApprovalService {
  async ask(): Promise<"allow"> {
    return "allow";
  }
}

export class DenyApprovalService implements ApprovalService {
  async ask(): Promise<"deny"> {
    return "deny";
  }
}

export class RecordingApprovalService implements ApprovalService {
  readonly requests: ApprovalRequest[] = [];
  private readonly decision: (request: ApprovalRequest) => "allow" | "deny";
  constructor(decision: (request: ApprovalRequest) => "allow" | "deny") {
    this.decision = decision;
  }
  async ask(request: ApprovalRequest): Promise<"allow" | "deny"> {
    this.requests.push(request);
    return this.decision(request);
  }
}

export interface BudgetSnapshot {
  usedUsd: number;
  limitUsd: number;
  remainingUsd: number;
  taskUsedUsd: number;
  taskCapUsd: number;
  warnedAtSoftThreshold: boolean;
}

export class BudgetService {
  private usedUsd = 0;
  private taskUsedUsd = 0;
  private warned = false;
  private readonly limitUsd: number;
  private readonly taskCapUsd: number;
  private readonly softThreshold: number;
  constructor(limitUsd: number, taskCapUsd: number, softThreshold = 0.8) {
    this.limitUsd = limitUsd;
    this.taskCapUsd = taskCapUsd;
    this.softThreshold = softThreshold;
  }

  precheck(): void {
    if (this.usedUsd >= this.limitUsd) {
      throw new BudgetExceededError("per-user LLM budget exhausted before request", {
        usedUsd: this.usedUsd,
        limitUsd: this.limitUsd,
      });
    }
  }

  record(costUsd: number): { warning: boolean; taskExceeded: boolean } {
    this.usedUsd += costUsd;
    this.taskUsedUsd += costUsd;
    const ratio = this.limitUsd === 0 ? 1 : this.usedUsd / this.limitUsd;
    const warning = !this.warned && ratio >= this.softThreshold;
    if (warning) this.warned = true;
    return { warning, taskExceeded: this.taskCapUsd > 0 && this.taskUsedUsd >= this.taskCapUsd };
  }

  snapshot(): BudgetSnapshot {
    return {
      usedUsd: this.usedUsd,
      limitUsd: this.limitUsd,
      remainingUsd: Math.max(0, this.limitUsd - this.usedUsd),
      taskUsedUsd: this.taskUsedUsd,
      taskCapUsd: this.taskCapUsd,
      warnedAtSoftThreshold: this.warned,
    };
  }
}

export interface ToolClassification {
  verdict: ApprovalVerdict;
  risk: string;
  reason: string;
  preview: string;
}

export interface RuntimeDeps {
  model: ModelClient;
  tools: ToolRegistry;
  approval: ApprovalService;
  budget: BudgetService;
  policy: Policy;
  repoClass: RepoClass;
  workspaceRoot: string;
  run: (options: RunOptions) => Promise<CommandResult>;
  estimateCost: (usage: TokenUsage, model: string) => number;
  /** Injected from the policy plane so core stays free of concrete policy imports. */
  classifyTool: (tool: string, args: Record<string, unknown>) => ToolClassification;
  artifactsDir?: string;
  research?: import("../../shared/src/types.ts").ResearchClient;
  tracePath?: string;
  maxSteps?: number;
  /** Explicit provider-qualified model alias (real gateways, per-arm runs). */
  modelAlias?: string;
  /** Per-phase model aliases; overrides modelAlias for that phase (cascade arms). */
  modelAliasByPhase?: Partial<Record<"explore" | "edit" | "verify" | "research" | "other", string>>;
  /** Docs Guard fact sheets and optional research client. */
  docsGuard?: { factSheets: Map<string, ApiFactSheet> };
}

export interface TaskReceiptResult {
  receipt: Receipt;
  trace: TraceRecord[];
  ok: boolean;
  events: SessionEvent[];
}

function phaseFor(step: number, usedEdit: boolean, usedVerify: boolean): "explore" | "edit" | "verify" {
  if (usedVerify) return "verify";
  if (usedEdit) return "edit";
  return step === 0 ? "explore" : "edit";
}

export async function runTask(session: Session, task: string, deps: RuntimeDeps): Promise<TaskReceiptResult> {
  const trace: TraceRecord[] = [];
  const confidential = deps.repoClass === "confidential";
  const maxSteps = deps.maxSteps ?? 12;
  let tokens: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
  let costUsd = 0;
  let fallbacks = 0;
  let status: Receipt["status"] = "success";
  let summary = "task completed";
  let usedEdit = false;
  let usedVerify = false;
  const startIndex = session.all.length;

  session.append("turn/start", { turn: 1 });
  session.append("user/message", { id: `msg_${startIndex}`, content: task, source: "user" });

  try {
    for (let step = 0; step < maxSteps; step += 1) {
      deps.budget.precheck();
      const phase = phaseFor(step, usedEdit, usedVerify);
      const context = buildContext(session.all, { policy: deps.policy, toolNames: deps.tools.names() });
      session.append("step/start", { turn: 1, step, phase });
      if (context.clearedCount > 0 || context.compacted) {
        session.append("context/metrics", context.context);
      }

      const request: ModelRequest = {
        messages: context.messages,
        modelAlias: deps.modelAliasByPhase?.[phase] ?? deps.modelAlias ?? process.env.GIDORAH_MODEL_ALIAS ?? (confidential ? "gidorah-local" : "gidorah-auto"),
        phase,
        sessionId: session.header.sessionId,
        confidential,
        ...(process.env.GIDORAH_MAX_TOKENS === undefined ? {} : { maxTokens: Number(process.env.GIDORAH_MAX_TOKENS) }),
        tools: deps.tools.schemas(),
      };

      let response;
      try {
        response = await deps.model.complete(request);
      } catch (error) {
        if (error instanceof BudgetExceededError) {
          status = "budget_exhausted";
          summary = error.message;
          break;
        }
        throw error;
      }

      const routing = response.routing;
      if (routing.fallback) {
        fallbacks += 1;
        session.append("route/changed", {
          from: routing.primary ?? routing.requested,
          to: routing.served,
          reason: `fallback #${routing.fallbackIndex ?? 1}`,
          fallbackIndex: routing.fallbackIndex ?? 1,
          requested: routing.requested,
          served: routing.served,
        });
      }

      const messageTokens = response.usage;
      tokens = {
        input: tokens.input + messageTokens.input,
        output: tokens.output + messageTokens.output,
        cacheRead: tokens.cacheRead + messageTokens.cacheRead,
        cacheWrite: tokens.cacheWrite + messageTokens.cacheWrite,
        total: tokens.total + messageTokens.total,
      };
      const stepCost = deps.estimateCost(messageTokens, routing.served.model);
      const budgetState = deps.budget.record(stepCost);
      costUsd += stepCost;
      if (budgetState.warning) {
        session.append("budget/updated", {
          kind: "llm",
          used: deps.budget.snapshot().usedUsd,
          limit: deps.budget.snapshot().limitUsd,
          currency: "USD",
          threshold: 0.8,
        });
      }
      if (budgetState.taskExceeded) {
        session.append("budget/task", { taskId: session.header.sessionId, usedUsd: deps.budget.snapshot().taskUsedUsd, capUsd: deps.budget.snapshot().taskCapUsd, action: deps.policy.budgets.task.on_limit });
        status = "budget_exhausted";
        summary = "per-task budget cap reached";
        break;
      }

      const traceRecord: TraceRecord = {
        requestId: `req_${trace.length + 1}`,
        sessionId: session.header.sessionId,
        taskId: session.header.sessionId,
        phase,
        requested: routing.requested,
        served: routing.served,
        fallback: routing.fallback,
        ...(routing.fallbackIndex === undefined ? {} : { fallbackIndex: routing.fallbackIndex }),
        cacheHit: routing.cacheHit,
        tokens: { input: messageTokens.input, cacheRead: messageTokens.cacheRead, cacheWrite: messageTokens.cacheWrite, output: messageTokens.output, total: messageTokens.total },
        costUsd: stepCost,
        latencyMs: routing.latencyMs,
        research: null,
        dlp: null,
        docsGuard: null,
        context: context.context,
        budgetAfter: {
          llmUsd: deps.budget.snapshot().usedUsd,
          researchCredits: 0,
          taskUsd: deps.budget.snapshot().taskUsedUsd,
        },
      };
      trace.push(traceRecord);

      session.append("assistant/message", {
        id: `msg_${session.all.length}`,
        content: redactSecrets(response.content).text,
        toolCalls: response.toolCalls,
        provider: routing.served.provider,
        model: routing.served.model,
        usage: messageTokens,
      });

      if (response.toolCalls.length === 0) {
        summary = response.content.slice(0, 200) || "task completed";
        break;
      }

      for (const call of response.toolCalls) {
        await executeToolCall(session, call, deps, { usedEdit, usedVerify }, (next) => {
          if (next === "edit") usedEdit = true;
          if (next === "verify") usedVerify = true;
        });
      }

      session.append("step/end", { turn: 1, step, reason: "tools executed" });
      if (step === maxSteps - 1) {
        status = "failed";
        summary = "step limit reached before the task completed";
      }
    }
  } catch (error) {
    if (error instanceof ProviderError) {
      status = "provider_error";
      summary = error.message;
    } else {
      status = "failed";
      summary = error instanceof Error ? error.message : String(error);
    }
    session.append("session/error", { code: "RUNTIME_ERROR", message: summary, retryable: false });
  }

  session.append("turn/end", { turn: 1, reason: status });
  session.append("audit/anchor", { chainHead: session.verify().head, at: Date.now() });
  const snapshot = deps.budget.snapshot();
  const receipt: Receipt = {
    sessionId: session.header.sessionId,
    taskId: session.header.sessionId,
    status,
    summary,
    tokens,
    llmCostUsd: costUsd,
    researchCredits: 0,
    fallbacks,
    budgetRemaining: { llmUsd: snapshot.remainingUsd, researchCredits: 0 },
    ...(deps.tracePath === undefined ? {} : { tracePath: deps.tracePath }),
  };
  return { receipt, trace, ok: status === "success", events: session.all.slice(startIndex) };
}

async function executeToolCall(
  session: Session,
  call: ToolCall,
  deps: RuntimeDeps,
  _phaseState: { usedEdit: boolean; usedVerify: boolean },
  onPhase: (phase: "edit" | "verify") => void,
): Promise<ToolResult> {
  session.append("tool/call", { callId: call.id, name: call.name, arguments: call.arguments });
  const tool = deps.tools.get(call.name);
  if (tool === undefined) {
    const result: ToolResult = { callId: call.id, ok: false, content: [{ type: "text", text: `unknown tool: ${call.name}` }], error: { code: "UNKNOWN_TOOL", message: `unknown tool: ${call.name}` } };
    session.append("tool/result", result);
    return result;
  }

  const decision = deps.classifyTool(call.name, call.arguments);

  let verdict: ApprovalVerdict = decision.verdict;
  if (verdict === "ask") {
    session.append("approval/request", { approvalId: `apr_${call.id}`, callId: call.id, tool: call.name, risk: decision.risk, preview: decision.preview });
    const answer = await deps.approval.ask({ callId: call.id, tool: call.name, risk: decision.risk, preview: decision.preview, reason: decision.reason });
    verdict = answer === "allow" ? "allow" : "deny";
    session.append("approval/decision", { approvalId: `apr_${call.id}`, decision: verdict, reason: decision.reason, decidedAt: Date.now() });
  }

  if (verdict !== "allow") {
    const result: ToolResult = {
      callId: call.id,
      ok: false,
      content: [{ type: "text", text: `Denied by policy: ${decision.reason}` }],
      error: { code: "POLICY_DENIED", message: decision.reason },
    };
    session.append("tool/result", result);
    return result;
  }

  const ctx: ToolContext = {
    cwd: deps.workspaceRoot,
    workspaceRoot: deps.workspaceRoot,
    sessionId: session.header.sessionId,
    callId: call.id,
    confidential: deps.repoClass === "confidential",
    run: deps.run,
    ...(deps.artifactsDir === undefined ? {} : { artifactsDir: deps.artifactsDir }),
    ...(deps.research === undefined ? {} : { research: deps.research }),
  };
  const result = await tool.run(call.arguments, ctx);
  session.append("tool/result", {
    callId: result.callId,
    ok: result.ok,
    content: result.content.map((block) => ({ type: "text", text: redactSecrets(block.text).text })),
    ...(result.error === undefined ? {} : { error: result.error }),
    ...(result.meta === undefined ? {} : { meta: result.meta }),
  });
  if (result.ok) {
    if (call.name === "write" || call.name === "edit") {
      onPhase("edit");
      await runDocsGuard(session, call, deps);
    }
    if (call.name === "bash" || call.name === "git") onPhase("verify");
  }
  return result;
}

/** Docs Guard runs once per edit when the change touches a documented SDK. */
async function runDocsGuard(session: Session, call: ToolCall, deps: RuntimeDeps): Promise<void> {
  if (!deps.policy.docsGuard.enabled || deps.repoClass === "confidential") return;
  const path = typeof call.arguments.path === "string" ? call.arguments.path : "";
  if (path === "") return;
  let content = "";
  try {
    content = readFileSync(resolve(deps.workspaceRoot, path), "utf8");
  } catch {
    return;
  }
  const packages = [...content.matchAll(/from\s+["']([^"'.][^"']*)["']/g)].map((match) => match[1] ?? "").filter((pkg) => !pkg.startsWith("node:"));
  const packageName = packages[0];
  if (packageName === undefined) return;
  const sheets = deps.docsGuard?.factSheets ?? new Map<string, ApiFactSheet>();
  const key = [...sheets.keys()].find((entry) => entry.startsWith(`${packageName}@`));
  if (key === undefined) return;
  const packageVersion = key.slice(packageName.length + 1);
  const replacement = String(call.arguments.replace ?? call.arguments.content ?? "");
  const memberCalls = [...replacement.matchAll(/\.\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map((match) => match[1] ?? "");
  const allCalls = [...replacement.matchAll(/\b([A-Za-z_][A-Za-z0-9_]{2,})\s*\(/g)].map((match) => match[1] ?? "");
  const symbols = (memberCalls.length > 0 ? memberCalls : allCalls).slice(0, 5);
  const outcome = await checkDocsGuard(
    { file: path, packageName, packageVersion, changedSymbols: symbols, repoLocalOnly: false },
    { factSheets: sheets, ...(deps.research === undefined ? {} : { research: deps.research }), maxLookupsPerEdit: deps.policy.docsGuard.max_lookups_per_edit },
  );
  session.append("docs/check", { package: packageName, version: packageVersion, symbols, result: outcome.result, advisory: outcome.advisory, lookups: outcome.lookups });
}

export function writeTrace(file: string, records: TraceRecord[]): void {
  for (const record of records) appendJsonl(file, record);
}
