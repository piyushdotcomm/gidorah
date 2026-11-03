/**
 * Validity test for the benchmark task set: every task's test must fail before
 * the edit and pass after it, in a real temporary repository. This prevents a
 * task set that silently passes or silently fails.
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runProcess } from "../../core/src/tools.ts";
import { BENCH_TASKS } from "../src/tasks.ts";
import { classifyToolCall } from "../../policy/src/approval.ts";
import { classifyRepo } from "../../policy/src/classify.ts";
import { DEFAULT_POLICY } from "../../policy/src/schema.ts";

test("benchmark tasks: Class A covers repo-local fixes, Class B requires runtime docs", () => {
  const classA = BENCH_TASKS.filter((task) => task.class === "A");
  const classB = BENCH_TASKS.filter((task) => task.class === "B");
  assert.ok(classA.length >= 6, `need 6+ Class A tasks, got ${classA.length}`);
  assert.ok(classB.length >= 6, `need 6+ Class B tasks, got ${classB.length}`);
  for (const task of classA) assert.equal(task.allowedResearch, 0, `${task.id} Class A must allow zero research`);
  for (const task of classB) assert.ok(task.allowedResearch > 0, `${task.id} Class B must allow research`);
  const nodeApis = BENCH_TASKS.filter((task) => task.class === "B").map((task) => task.goal).join(" ");
  assert.ok(/node:sqlite|AbortSignal|loadEnvFile|crypto|mock|Response/.test(nodeApis), "Class B must mention current runtime APIs");
});

for (const task of BENCH_TASKS) {
  test(`task ${task.id} fails before the edit and passes after it`, async () => {
    const root = mkdtempSync(join(tmpdir(), `gidorah-task-${task.id}-`));
    try {
      mkdirSync(root, { recursive: true });
      for (const [file, content] of Object.entries(task.files)) {
        const full = join(root, file);
        mkdirSync(join(full, ".."), { recursive: true });
        writeFileSync(full, content, "utf8");
      }
      const before = await runProcess({ command: task.testCommand, args: [], cwd: root, shell: true, timeoutMs: 30_000 });
      assert.notEqual(before.code, 0, `${task.id} passed before the edit; the task is not failing`);
      const source = task.files[task.edit.path]!;
      assert.ok(source.includes(task.edit.find), `${task.id} edit.find does not match the fixture`);
      writeFileSync(join(root, task.edit.path), source.replace(task.edit.find, task.edit.replace), "utf8");
      const after = await runProcess({ command: task.testCommand, args: [], cwd: root, shell: true, timeoutMs: 30_000 });
      assert.equal(after.code, 0, `${task.id} still fails after the edit: ${after.stderr || after.stdout}`.slice(0, 400));
      const classification = classifyRepo(DEFAULT_POLICY, root);
      const decision = classifyToolCall("edit", { path: task.edit.path, find: task.edit.find, replace: task.edit.replace }, { policy: DEFAULT_POLICY, classification, cwd: root, workspaceRoot: root });
      assert.equal(decision.verdict, "ask", `${task.id} edit should require approval`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
