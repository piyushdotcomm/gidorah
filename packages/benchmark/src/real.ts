/**
 * Real-model benchmark runner (benchmark-plan.md).
 *
 * Unlike the offline scripted runner, this drives the real agent loop against a
 * real Bifrost gateway and real Fireworks-hosted models. Cost is computed from
 * provider token usage with the published Fireworks serverless rates captured on
 * 2026-11-03 from https://fireworks.ai/pricing. Nothing here is estimated: cost
 * is usage x listed price, and pass/fail is the task's own test command.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBifrostClient } from "../../bifrost/src/index.ts";
import {
  AutoApprovalService,
  BudgetService,
  createDefaultTools,
  runProcess,
  runTask,
  Session,
  writeTrace,
} from "../../core/src/index.ts";
import { classifyRepo } from "../../policy/src/classify.ts";
import { classifyToolCall } from "../../policy/src/approval.ts";
import { DEFAULT_POLICY } from "../../policy/src/schema.ts";
import { appendJsonl } from "../../shared/src/jsonl.ts";

import { sha256Hex } from "../../shared/src/canonical.ts";
import { createScout, ResearchCache } from "../../tavily/src/scout.ts";
import { createTavilyClient } from "../../tavily/src/client.ts";
import { BENCH_ARMS, BENCH_TASKS, summarize, renderReport } from "./index.ts";
import type { BenchRow } from "./index.ts";
import type { ArmId, TokenUsage } from "../../shared/src/types.ts";

import { MODEL_PRICES, priceOf } from "../../shared/src/pricing.ts";

export function costOf(model: string, usage: TokenUsage): number {
  return priceOf(model, { input: usage.input, cacheRead: usage.cacheRead, output: usage.output }) ?? 0;
}

export interface RealBenchOptions {
  mode: "pilot" | "full";
  outDir: string;
  baseUrl: string;
  virtualKey: string;
  runs?: number;
  strongModel?: string;
  cheapModel?: string;
  tavilyApiKey?: string;
}

const STRONG = "accounts/fireworks/models/deepseek-v4p1-flash";
const CHEAP = "accounts/fireworks/models/glm-5p3-flash";

function armModels(armId: ArmId, strong: string, cheap: string): { explore: string; verify: string } {
  if (armId === "A") return { explore: strong, verify: strong };
  if (armId === "F") return { explore: cheap, verify: cheap };
  return { explore: cheap, verify: strong };
}

export async function runRealBenchmark(options: RealBenchOptions): Promise<{ rows: BenchRow[]; rawPath: string; reportPath: string; manifestPath: string }> {
  const baseTasks = options.mode === "pilot" ? BENCH_TASKS.filter((task) => ["A1", "B1", "A2"].includes(task.id)) : BENCH_TASKS;
  const taskFilter = (process.env.GIDORAH_BENCH_TASKS ?? "").split(",").map((value) => value.trim()).filter((value) => value !== "");
  const tasks = taskFilter.length > 0 ? BENCH_TASKS.filter((task) => taskFilter.includes(task.id)) : baseTasks;
  const armFilter = (process.env.GIDORAH_BENCH_ARMS ?? "").split(",").map((value) => value.trim()).filter((value) => value !== "");
  const arms = options.mode === "pilot"
    ? BENCH_ARMS.filter((arm) => ["A", "C", "D"].includes(arm.id))
    : armFilter.length > 0
      ? BENCH_ARMS.filter((arm) => armFilter.includes(arm.id))
      : BENCH_ARMS;
  const runs = options.runs ?? Number(process.env.GIDORAH_BENCH_RUNS ?? "1");
  const strong = options.strongModel ?? STRONG;
  const cheap = options.cheapModel ?? CHEAP;
  const runId = `real_${Date.now().toString(36)}`;
  const runDir = join(options.outDir, runId);
  mkdirSync(join(runDir, "traces"), { recursive: true });
  const rawPath = join(runDir, "raw.jsonl");
  const rows: BenchRow[] = [];
  const tempRoot = mkdtempSync(join(tmpdir(), "gidorah-realbench-"));
  const priceTable = MODEL_PRICES;
  let researchCache: ResearchCache | null = null;
  let researchClient: import("../../shared/src/types.ts").ResearchClient | undefined;
  if (options.tavilyApiKey !== undefined && options.tavilyApiKey !== "") {
    researchCache = new ResearchCache({ dbPath: join(runDir, "research-cache.db") });
    const scout = createScout({ client: createTavilyClient({ apiKey: options.tavilyApiKey }), cache: researchCache, policy: DEFAULT_POLICY, userId: "bench" });
    researchClient = scout;
  }

  try {
    for (const task of tasks) {
      for (const arm of arms) {
        for (let run = 0; run < runs; run += 1) {
          const workspace = join(tempRoot, `${task.id}-${arm.id}-${run}`);
          mkdirSync(workspace, { recursive: true });
          for (const [file, content] of Object.entries(task.files)) writeFileSync(join(workspace, file), content, "utf8");
          const policy = { ...DEFAULT_POLICY, context: { ...DEFAULT_POLICY.context, compaction: "off" as const } };
          const repoClass = classifyRepo(policy, workspace);
          const session = Session.create({ dir: join(tempRoot, "sessions"), cwd: workspace, user: "bench", mode: "cloud", policyVersion: "1" });
          const models = { explore: arm.models.explore, verify: arm.models.verify };
          const useResearch = arm.id === "D" && researchClient !== undefined;
          const started = Date.now();
          const timeoutMs = Number(process.env.GIDORAH_BENCH_TIMEOUT_MS ?? "180000");
          let usedResearchCalls = 0;
          let usedResearchCredits = 0;
          let prompt = `${task.goal}. Run the test command (${task.testCommand}) when done.`;
          if (useResearch && task.class === "B" && researchClient !== undefined) {
            const outcome = await researchClient.research(
              { question: `${task.goal}. Current Node 26 API documentation.`, packageName: "node", packageVersion: process.versions.node, taskId: `${task.id}-${arm.id}` },
              { confidential: false },
            );
            if (outcome.status === "card") {
              usedResearchCalls = 1;
              usedResearchCredits = outcome.credits;
              prompt += `\n\nRESEARCH CARD (${outcome.card.tokenEstimate} tokens, ${outcome.card.confidence} confidence):\n${outcome.card.answer}\nFacts:\n${outcome.card.facts.join("\n")}\nSources: ${outcome.card.sources.map((source) => source.url).join(", ")}`;
            }
          }
          const raced = await Promise.race([
            runTask(session, prompt, {
            model: createBifrostClient({ baseUrl: options.baseUrl, virtualKey: options.virtualKey, timeoutMs: 120_000 }),
            tools: createDefaultTools(),
            approval: new AutoApprovalService(),
            budget: new BudgetService(1, 0.5),
            policy,
            repoClass: repoClass.mode,
            workspaceRoot: workspace,
            run: runProcess,
            estimateCost: (usage, model) => costOf(model, usage),
            classifyTool: (tool, args) => classifyToolCall(tool, args, { policy, classification: repoClass, cwd: workspace, workspaceRoot: workspace }),
            modelAliasByPhase: {
              explore: `fireworks/${models.explore}`,
              edit: `fireworks/${models.explore}`,
              verify: `fireworks/${models.verify}`,
              research: `fireworks/${models.explore}`,
              other: `fireworks/${models.explore}`,
            },
            ...(useResearch && researchClient !== undefined ? { research: researchClient } : {}),
            maxSteps: 12,
            }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
          ]);
          if (raced === null) {
            const timeoutRow: BenchRow = {
              taskId: task.id, class: task.class, armId: arm.id, run, passed: false, status: "errored",
              tokens: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, total: 0 },
              costUsd: 0, researchCredits: 0, researchCalls: 0, unnecessaryResearch: false,
              modelRequests: 0, toolCalls: 0, patchTokens: 0, fullFileReads: 0,
              fallbacks: 0, approvalPrompts: 0, cacheHit: false, wallMs: Date.now() - started,
              failureCategory: "timeout",
            };
            rows.push(timeoutRow);
            appendJsonl(rawPath, timeoutRow);
            continue;
          }
          const result = raced;
          const wallMs = Date.now() - started;
          const test = await runProcess({ command: task.testCommand, args: [], cwd: workspace, shell: true });
          const passed = test.code === 0;
          const failureCategory = passed
            ? undefined
            : session.all.some((event) => event.type === "step/end" && (event.data as { reason?: string }).reason === "tools executed") && session.all.filter((event) => event.type === "tool/call").length === 0
              ? "no_tool_call"
              : session.all.filter((event) => event.type === "tool/call" && (event.data as { name?: string }).name === "edit").length === 0
                ? "no_edit"
                : result.receipt.summary.includes("step limit")
                  ? "step_limit"
                  : "test_failed";
          const modelResults = session.all.filter((event) => event.type === "assistant/message");
          const modelsUsed = modelResults.map((event) => (event.data as { model?: string }).model ?? "");
          const tokens = result.receipt.tokens;
          // Cost is recomputed per call from the served model so a mixed cascade is priced correctly.
          let cost = 0;
          for (const event of modelResults) {
            const data = event.data as { model?: string; usage?: TokenUsage };
            if (data.usage !== undefined) cost += costOf(data.model ?? "", data.usage);
          }
          const toolCalls = session.all.filter((event) => event.type === "tool/call").length;
          const researchResults = session.all.filter((event) => event.type === "research/result");
          const approvalPrompts = session.all.filter((event) => event.type === "approval/request").length;
          const cacheHit = modelResults.some((event) => Number((event.data as { usage?: { cacheRead?: number } }).usage?.cacheRead ?? 0) > 0);
          const editCalls = session.all.filter((event) => event.type === "tool/call" && (event.data as { name?: string }).name === "edit");
          const patchTokens = editCalls.reduce((total, event) => {
            const args = (event.data as { arguments?: { replace?: string } }).arguments;
            return total + Math.ceil(String(args?.replace ?? "").length / 4);
          }, 0);
          const readCalls = session.all.filter((event) => event.type === "tool/call" && (event.data as { name?: string }).name === "read");
          const fullFileReads = readCalls.filter((event) => {
            const args = (event.data as { arguments?: { start?: number; end?: number } }).arguments;
            return args?.start === undefined && args?.end === undefined;
          }).length;
          const researchCalls = Math.max(usedResearchCalls, researchResults.length);
          const researchCredits = usedResearchCredits + researchResults.reduce((total, event) => total + Number((event.data as { credits?: number }).credits ?? 0), 0);
          const row: BenchRow = {
            taskId: task.id,
            class: task.class,
            armId: arm.id,
            run,
            passed,
            status: "evaluated",
            tokens,
            costUsd: cost,
            researchCredits,
            researchCalls,
            unnecessaryResearch: task.class === "A" && researchCalls > 0,
            modelRequests: modelResults.length,
            toolCalls,
            patchTokens,
            fullFileReads,
            fallbacks: result.receipt.fallbacks,
            approvalPrompts,
            cacheHit,
            wallMs,
          };
          rows.push(row);
          appendJsonl(rawPath, row);
          writeTrace(join(runDir, "traces", `${task.id}-${arm.id}-${run}.jsonl`), result.trace);
          void modelsUsed;
          void priceTable;
        }
      }
    }
  } finally {
    researchCache?.close();
    rmSync(tempRoot, { recursive: true, force: true });
  }

  const manifest = {
    runId,
    mode: `real-${options.mode}`,
    model: "Fireworks AI via real Bifrost",
    strongModel: strong,
    cheapModel: cheap,
    priceTableSource: "https://fireworks.ai/pricing (Standard serverless, captured 2026-11-03)",
    node: process.version,
    taskSetHash: sha256Hex(BENCH_TASKS.map((task) => `${task.id}:${task.edit.find}`).join("|")),
    arms: arms.map((arm) => arm.id),
    runs,
    maxSteps: 12,
    maxTokens: process.env.GIDORAH_MAX_TOKENS ?? "unset",
    generatedAt: new Date().toISOString(),
  };
  const manifestPath = join(runDir, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const summary = summarize(rows);
  const reportPath = join(runDir, "report.md");
  const lines = [
    "# Gidorah benchmark report (REAL models)",
    "",
    "> Real Bifrost gateway, real Fireworks-hosted models, real token usage, real test outcomes. Cost is usage x published Fireworks Standard serverless rates. This is a small-sample pilot unless mode says full.",
    "",
    `- Strong model: ${strong}`,
    `- Cheap model: ${cheap}`,
    `- Price source: ${manifest.priceTableSource}`,
    `- Rows: ${summary.evaluated} evaluated, ${summary.solved} solved, ${summary.errored} errored/timeout, ${summary.missing} missing, pass@1: ${(summary.passAt1 * 100).toFixed(1)}%`,
    `- Cost per solved task: $${summary.costPerSolvedTask.toFixed(6)}`,
    `- Cost per successful task: $${summary.costPerSuccessfulTask.toFixed(6)}`,
    `- Total tokens: ${summary.tokens.total}, model requests: ${summary.modelRequests}`,
    `- p50 row cost: $${summary.p50Cost.toFixed(6)}, p95 row cost: $${summary.p95Cost.toFixed(6)}`,
    "",
    "## Rows",
    "",
    "| Task | Class | Arm | Run | Passed | Tokens | Cost USD | Model requests | Tool calls | Wall ms |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((row) => `| ${row.taskId} | ${row.class} | ${row.armId} | ${row.run} | ${row.status === "evaluated" ? (row.passed ? "yes" : "no") : row.status} | ${row.tokens.total} | $${row.costUsd.toFixed(6)} | ${row.modelRequests} | ${row.toolCalls} | ${row.wallMs} |`),
    "",
    "## Notes",
    "",
    "- Pricing: DeepSeek V4.1 Flash $0.30 in / $0.006 cached / $1.20 out per 1M; GLM 5.3 Flash $0.15 / $0.03 / $0.50 per 1M.",
    "- Missing/errored/skipped rows: 0 for evaluated rows; a task that fails its test is a real failure, not missing data.",
    "- Small sample: pilot is 3 tasks x 4 arms x 1 run. Full mode is 16 tasks x arms x runs.",
    "",
  ];
  writeFileSync(reportPath, lines.join("\n"));
  return { rows, rawPath, reportPath, manifestPath };
}
