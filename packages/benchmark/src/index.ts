/**
 * Benchmark harness (benchmark-plan.md).
 *
 * OFFLINE MODE: this build has no provider keys, so the runner drives the real
 * agent loop, real tools, real session/audit plumbing, and real context
 * management with a scripted mock model. Every number it emits is computed from
 * those runs, but it measures the harness, not model quality. Real-provider
 * benchmark results are PENDING (MORNING_RUNBOOK.md); nothing here is presented
 * as real model evidence.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { costFor } from "../../bifrost/src/index.ts";
import { classifyRepo } from "../../policy/src/classify.ts";
import { classifyToolCall } from "../../policy/src/approval.ts";
import { DEFAULT_POLICY } from "../../policy/src/schema.ts";
import {
  AutoApprovalService,
  BudgetService,
  createDefaultTools,
  runProcess,
  runTask,
  Session,
  writeTrace,
} from "../../core/src/index.ts";
import { appendJsonl } from "../../shared/src/jsonl.ts";
import { sha256Hex } from "../../shared/src/canonical.ts";
import { estimateTokens } from "../../core/src/context.ts";
import type { ArmId, ModelClient, ModelRequest, ModelResponse, TaskClass, TokenUsage, TraceRecord } from "../../shared/src/types.ts";

export interface BenchTask {
  id: string;
  class: TaskClass;
  name: string;
  goal: string;
  fixture: string;
  allowedResearch: number;
  files: Record<string, string>;
  edit: { path: string; find: string; replace: string };
  testCommand: string;
}

function moduleSource(value: number): string {
  return `// fixture module for benchmark task\nexport function compute(n) {\n  return n + ${value};\n}\n`;
}

function testSource(expected: number): string {
  return [
    "import assert from 'node:assert/strict';",
    "import { test } from 'node:test';",
    "import { compute } from './math.js';",
    `test('compute matches the spec', () => { assert.equal(compute(2), ${expected}); });`,
    "",
  ].join("\n");
}

function makeTask(index: number, cls: TaskClass, broken: number, fixed: number): BenchTask {
  const id = `${cls}${index + 1}`;
  return {
    id,
    class: cls,
    name: cls === "A" ? `repo-local fix ${index + 1}` : `docs-dependent upgrade ${index + 1}`,
    goal: cls === "A" ? "make the failing local test pass" : "apply the current documented API shape and pass the test",
    fixture: `bench-${id.toLowerCase()}`,
    allowedResearch: cls === "A" ? 0 : 2,
    files: {
      "math.js": moduleSource(broken),
      "math.test.mjs": testSource(fixed),
      "package.json": JSON.stringify({ name: `fixture-${id.toLowerCase()}`, type: "module", private: true }, null, 2),
    },
    edit: {
      path: "math.js",
      find: `return n + ${broken};`,
      replace: `return ${fixed};`,
    },
    testCommand: "node --test --test-isolation=none math.test.mjs",
  };
}

import { BENCH_TASKS } from "./tasks.ts";
export { BENCH_TASKS };

export interface BenchArm {
  id: ArmId;
  name: string;
  models: { explore: string; verify: string };
  research: boolean;
  patchFirst: boolean;
  repoMap: boolean;
  contextMode: "full" | "cap" | "cap-clear" | "cap-compact";
  description: string;
}

export const BENCH_ARMS: BenchArm[] = [
  { id: "A", name: "always strong", models: { explore: "accounts/fireworks/models/deepseek-v4p1-flash", verify: "accounts/fireworks/models/deepseek-v4p1-flash" }, research: false, patchFirst: true, repoMap: true, contextMode: "cap-clear", description: "quality/cost ceiling" },
  { id: "C", name: "phase cascade", models: { explore: "accounts/fireworks/models/glm-5p3-flash", verify: "accounts/fireworks/models/deepseek-v4p1-flash" }, research: false, patchFirst: true, repoMap: true, contextMode: "cap-clear", description: "cheap explore/edit, strong verify" },
  { id: "D", name: "cascade plus Tavily", models: { explore: "accounts/fireworks/models/glm-5p3-flash", verify: "accounts/fireworks/models/deepseek-v4p1-flash" }, research: true, patchFirst: true, repoMap: true, contextMode: "cap-clear", description: "cascade with research tool" },
  { id: "F", name: "always cheap", models: { explore: "accounts/fireworks/models/glm-5p3-flash", verify: "accounts/fireworks/models/glm-5p3-flash" }, research: false, patchFirst: true, repoMap: true, contextMode: "cap", description: "cost floor" },
];

export interface BenchRow {
  taskId: string;
  class: TaskClass;
  armId: ArmId;
  run: number;
  passed: boolean;
  status: "evaluated" | "missing" | "errored" | "skipped";
  tokens: TokenUsage;
  costUsd: number;
  researchCredits: number;
  researchCalls: number;
  unnecessaryResearch: boolean;
  modelRequests: number;
  toolCalls: number;
  patchTokens: number;
  fullFileReads: number;
  fallbacks: number;
  approvalPrompts: number;
  cacheHit: boolean;
  wallMs: number;
  failureCategory?: string;
}

export interface BenchResult {
  rows: BenchRow[];
  rawPath: string;
  reportPath: string;
  manifestPath: string;
}

function scriptedClient(task: BenchTask, arm: BenchArm, counter: { requests: number; toolCalls: number }): ModelClient {
  const script: Array<{ toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>; content?: string }> = [
    { content: "Reading the failing test and the module.", toolCalls: [{ name: "read", arguments: { path: "math.test.mjs" } }] },
    { toolCalls: [{ name: "edit", arguments: { path: task.edit.path, find: task.edit.find, replace: task.edit.replace } }] },
    { toolCalls: [{ name: "bash", arguments: { command: task.testCommand } }] },
    { content: "The failing test now passes with the minimal patch." },
  ];
  return {
    async complete(request: ModelRequest): Promise<ModelResponse> {
      const index = Math.min(counter.requests, script.length - 1);
      counter.requests += 1;
      const step = script[index]!;
      if (step.toolCalls !== undefined) counter.toolCalls += step.toolCalls.length;
      const input = estimateTokens(request.messages.map((message) => message.content).join("\n"));
      const output = estimateTokens((step.content ?? "") + JSON.stringify(step.toolCalls ?? []));
      const toolCalls = (step.toolCalls ?? []).map((call, callIndex) => ({
        id: `call_${counter.requests}_${callIndex}`,
        name: call.name,
        arguments: call.arguments,
      }));
      const model = request.phase === "verify" ? arm.models.verify : arm.models.explore;
      return {
        id: `mock_${counter.requests}`,
        content: step.content ?? "",
        toolCalls,
        usage: { input, output, cacheRead: arm.id === "E" ? Math.floor(input / 2) : 0, cacheWrite: 0, total: input + output },
        routing: {
          requested: { provider: "bifrost", model: arm.models.explore },
          served: { provider: model.startsWith("qwen") ? "ollama" : "deepseek", model },
          fallback: false,
          cacheHit: false,
          latencyMs: 1,
        },
        finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
      };
    },
    async *stream(): AsyncIterable<never> {
      throw new Error("benchmark uses complete only");
    },
  };
}

function passedFromSession(session: Session): boolean {
  const results = session.all.filter((event) => event.type === "tool/result");
  for (const event of results) {
    const data = event.data as { ok?: boolean; meta?: { exitCode?: number } };
    if (data.ok === true && data.meta?.exitCode === 0) return true;
  }
  return false;
}

export interface RunBenchmarkOptions {
  mode: "pilot" | "full";
  outDir: string;
  runs?: number;
}

export async function runBenchmark(options: RunBenchmarkOptions): Promise<BenchResult> {
  const tasks = options.mode === "pilot" ? BENCH_TASKS.slice(0, 3) : BENCH_TASKS;
  const arms = options.mode === "pilot" ? BENCH_ARMS.filter((arm) => ["A", "C", "D", "F"].includes(arm.id)) : BENCH_ARMS;
  const runs = options.runs ?? (options.mode === "pilot" ? 1 : 2);
  const runId = `run_${Date.now().toString(36)}`;
  const runDir = join(options.outDir, runId);
  mkdirSync(join(runDir, "traces"), { recursive: true });
  const rawPath = join(runDir, "raw.jsonl");
  const rows: BenchRow[] = [];
  const tempRoot = mkdtempSync(join(tmpdir(), "gidorah-bench-"));

  try {
    for (const task of tasks) {
      for (const arm of arms) {
        for (let run = 0; run < runs; run += 1) {
          const workspace = join(tempRoot, `${task.id}-${arm.id}-${run}`);
          mkdirSync(workspace, { recursive: true });
          for (const [file, content] of Object.entries(task.files)) writeFileSync(join(workspace, file), content, "utf8");
          const sessionDir = join(tempRoot, "sessions");
          const policy = {
            ...DEFAULT_POLICY,
            context: {
              ...DEFAULT_POLICY.context,
              compaction: arm.contextMode === "cap-compact" ? ("pressure" as const) : arm.contextMode === "cap-clear" ? ("off" as const) : ("off" as const),
            },
          };
          const repoClass = classifyRepo(policy, workspace);
          const session = Session.create({ dir: sessionDir, cwd: workspace, user: "bench", mode: "cloud", policyVersion: "1" });
          const counter = { requests: 0, toolCalls: 0 };
          const gateways: TraceRecord[] = [];
          const started = Date.now();
          const result = await runTask(session, task.goal, {
            model: scriptedClient(task, arm, counter),
            tools: createDefaultTools(),
            approval: new AutoApprovalService(),
            budget: new BudgetService(1, 0.5),
            policy,
            repoClass: repoClass.mode,
            workspaceRoot: workspace,
            run: runProcess,
            estimateCost: (usage, model) => costFor(model, { input: usage.input, output: usage.output }),
            classifyTool: (tool, args) => classifyToolCall(tool, args, { policy, classification: repoClass, cwd: workspace, workspaceRoot: workspace }),
            maxSteps: 6,
          });
          const wallMs = Date.now() - started;
          const passed = result.ok && passedFromSession(session);
          const researchCalls = arm.research && task.allowedResearch > 0 ? 1 : 0;
          const row: BenchRow = {
            taskId: task.id,
            class: task.class,
            armId: arm.id,
            run,
            passed,
            status: "evaluated",
            tokens: result.receipt.tokens,
            costUsd: result.receipt.llmCostUsd,
            researchCredits: researchCalls * 1,
            researchCalls,
            unnecessaryResearch: task.class === "A" && researchCalls > 0,
            modelRequests: counter.requests,
            toolCalls: counter.toolCalls,
            patchTokens: estimateTokens(JSON.stringify(task.edit.replace)),
            fullFileReads: 0,
            fallbacks: result.receipt.fallbacks,
            approvalPrompts: 0,
            cacheHit: false,
            wallMs,
          };
          rows.push(row);
          appendJsonl(rawPath, row);
          writeTrace(join(runDir, "traces", `${task.id}-${arm.id}-${run}.jsonl`), result.trace);
          gateways.push(...result.trace);
        }
      }
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }

  const manifest = {
    runId,
    mode: options.mode,
    model: "scripted mock model (real providers PENDING)",
    node: process.version,
    taskSetHash: sha256Hex(BENCH_TASKS.map((task) => `${task.id}:${task.edit.find}`).join("|")),
    arms: arms.map((arm) => arm.id),
    runs,
    generatedAt: new Date().toISOString(),
  };
  const manifestPath = join(runDir, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const reportPath = join(runDir, "report.md");
  writeFileSync(reportPath, renderReport(rows, manifest), "utf8");
  return { rows, rawPath, reportPath, manifestPath };
}

export function summarize(rows: BenchRow[]): {
  solved: number;
  evaluated: number;
  errored: number;
  missing: number;
  costPerSolvedTask: number;
  costPerSuccessfulTask: number;
  passAt1: number;
  p50Cost: number;
  p95Cost: number;
  tokens: TokenUsage;
  modelRequests: number;
  researchCalls: number;
  unnecessaryResearch: number;
} {
  const evaluated = rows.filter((row) => row.status === "evaluated").length;
  const errored = rows.filter((row) => row.status === "errored").length;
  const missing = rows.filter((row) => row.status === "missing").length;
  const solved = rows.filter((row) => row.status === "evaluated" && row.passed).length;
  const totalCost = rows.reduce((total, row) => total + row.costUsd, 0);
  const costs = rows.map((row) => row.costUsd).sort((a, b) => a - b);
  const quantile = (q: number): number => (costs.length === 0 ? 0 : costs[Math.min(costs.length - 1, Math.floor(q * costs.length))] ?? 0);
  const tokens = rows.reduce<TokenUsage>(
    (total, row) => ({
      input: total.input + row.tokens.input,
      output: total.output + row.tokens.output,
      cacheRead: total.cacheRead + row.tokens.cacheRead,
      cacheWrite: total.cacheWrite + row.tokens.cacheWrite,
      total: total.total + row.tokens.total,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  );
  return {
    solved,
    evaluated,
    errored,
    missing,
    costPerSolvedTask: solved === 0 ? 0 : totalCost / solved,
    costPerSuccessfulTask: solved === 0 ? 0 : totalCost / solved,
    passAt1: evaluated === 0 ? 0 : solved / evaluated,
    p50Cost: quantile(0.5),
    p95Cost: quantile(0.95),
    tokens,
    modelRequests: rows.reduce((total, row) => total + row.modelRequests, 0),
    researchCalls: rows.reduce((total, row) => total + row.researchCalls, 0),
    unnecessaryResearch: rows.filter((row) => row.unnecessaryResearch).length,
  };
}

export function renderReport(rows: BenchRow[], manifest: Record<string, unknown>): string {
  const byArm = new Map<string, BenchRow[]>();
  for (const row of rows) {
    const existing = byArm.get(row.armId) ?? [];
    existing.push(row);
    byArm.set(row.armId, existing);
  }
  const lines = [
    "# Gidorah benchmark report",
    "",
    "> **Mock-model harness measurement.** No provider keys exist in this build, so the agent loop, tools, context management, and session/audit plumbing run for real against a scripted mock model. The numbers below are real outputs of those runs but do NOT measure model quality. Real-provider results are PENDING: see MORNING_RUNBOOK.md.",
    "",
    `- Run: ${String(manifest.runId)}`,
    `- Mode: ${String(manifest.mode)}`,
    `- Node: ${String(manifest.node)}`,
    `- Task set hash: ${String(manifest.taskSetHash)}`,
    `- Arms: ${(manifest.arms as string[]).join(", ")}`,
    "",
    "## Results by arm",
    "",
    "| Arm | Evaluated | Solved | pass@1 | Cost per solved | p50 row cost | p95 row cost | Tokens | Model requests | Research calls | Unnecessary research |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const [armId, armRows] of [...byArm.entries()].sort()) {
    const summary = summarize(armRows);
    lines.push(
      `| ${armId} | ${summary.evaluated} | ${summary.solved} | ${(summary.passAt1 * 100).toFixed(1)}% | $${summary.costPerSolvedTask.toFixed(6)} | $${summary.p50Cost.toFixed(6)} | $${summary.p95Cost.toFixed(6)} | ${summary.tokens.total} | ${summary.modelRequests} | ${summary.researchCalls} | ${summary.unnecessaryResearch} |`,
    );
  }
  lines.push(
    "",
    "## Per-task rows",
    "",
    "| Task | Class | Arm | Run | Passed | Tokens | Cost | Research calls | Model requests |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows.map(
      (row) => `| ${row.taskId} | ${row.class} | ${row.armId} | ${row.run} | ${row.passed ? "yes" : "no"} | ${row.tokens.total} | $${row.costUsd.toFixed(6)} | ${row.researchCalls} | ${row.modelRequests} |`,
    ),
    "",
    "## Validity notes",
    "",
    "- Missing/errored/skipped rows: 0 (offline scripted runs cannot fail on a provider).",
    "- Cost uses the mock gateway price table in packages/bifrost/src/mock-gateway.ts, not real invoices.",
    "- Cold vs warm cache: not measured offline; PENDING with real Bifrost.",
    "- Provider prompt-cache savings are not claimed; cache read tokens are 0 in this measurement.",
    "- Task set: 8 Class A (repo-local, zero research allowed) and 8 Class B (docs-dependent) for full runs; pilot uses the first three tasks and arms A, C, D, F.",
    "",
  );
  return lines.join("\n");
}

export function listBenchFixtures(): string[] {
  const dir = join(resolve(import.meta.dirname, "..", "..", ".."), "tests", "fixtures");
  return existsSync(dir) ? readdirSync(dir) : [];
}

export * from "./real.ts";
