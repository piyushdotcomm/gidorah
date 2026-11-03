import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AutoApprovalService, BudgetService, runTask } from "../src/runtime.ts";
import { Session } from "../src/session.ts";
import { createDefaultTools, runProcess } from "../src/tools.ts";
import { classifyRepo } from "../../policy/src/classify.ts";
import { classifyToolCall } from "../../policy/src/approval.ts";
import { DEFAULT_POLICY } from "../../policy/src/schema.ts";
import type { ModelClient, ModelRequest, ModelResponse } from "../../shared/src/types.ts";

test("cascade: explore and edit use the cheap alias, verify uses the strong alias", async () => {
  const root = mkdtempSync(join(tmpdir(), "gidorah-cascade-"));
  try {
    writeFileSync(join(root, "file.txt"), "hello\n");
    const seen: string[] = [];
    const steps = [
      { toolCalls: [{ name: "edit", arguments: { path: "file.txt", find: "hello", replace: "hello world" } }] },
      { toolCalls: [{ name: "bash", arguments: { command: "node --version" } }] },
      { content: "done" },
    ];
    let index = 0;
    const model: ModelClient = {
      async complete(request: ModelRequest): Promise<ModelResponse> {
        seen.push(request.modelAlias);
        const step = steps[Math.min(index, steps.length - 1)]!;
        index += 1;
        const toolCalls = (step.toolCalls ?? []).map((call, callIndex) => ({ id: `c${index}_${callIndex}`, name: call.name, arguments: call.arguments }));
        return {
          id: `m${index}`, content: step.content ?? "", toolCalls,
          usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, total: 15 },
          routing: { requested: { provider: "fireworks", model: request.modelAlias }, served: { provider: "fireworks", model: request.modelAlias }, fallback: false, cacheHit: false, latencyMs: 1 },
          finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
        };
      },
      async *stream(): AsyncIterable<never> {
        throw new Error("not used");
      },
    };
    const classification = classifyRepo(DEFAULT_POLICY, root);
    const session = Session.create({ dir: join(root, ".sessions"), cwd: root, user: "test", mode: "cloud", policyVersion: "1" });
    await runTask(session, "edit then verify", {
      model,
      tools: createDefaultTools(),
      approval: new AutoApprovalService(),
      budget: new BudgetService(1, 1),
      policy: DEFAULT_POLICY,
      repoClass: classification.mode,
      workspaceRoot: root,
      run: runProcess,
      estimateCost: () => 0,
      classifyTool: (tool, args) => classifyToolCall(tool, args, { policy: DEFAULT_POLICY, classification, cwd: root, workspaceRoot: root }),
      modelAliasByPhase: { explore: "cheap-1", edit: "cheap-1", verify: "strong-9" },
    });
    assert.deepEqual(seen, ["cheap-1", "cheap-1", "strong-9"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
