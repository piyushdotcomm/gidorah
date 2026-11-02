/**
 * Test runner: finds every *.test.ts outside fixtures and runs the Node test
 * runner on it with type stripping enabled (Node 22.6+, default in Node 26).
 *
 * No external test framework is installed: the environment has no registry
 * access, so node:test is the harness (ADR-0013).
 */
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", ".git", ".gidorah", "fixtures", "node_modules", ".pnpm-store", "bench"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const roots = ["packages", "apps", "tests"].map((p) => join(ROOT, p));
const files: string[] = [];
for (const root of roots) {
  try {
    walk(root, files);
  } catch {
    // directory may not exist yet
  }
}

files.sort();
if (files.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}

console.log(`Running ${files.length} test files with node:test`);
// --test-isolation=none: the sandbox denies piped child-process stdio, and
// node:test's default per-file isolation spawns with pipes. Running all test
// files in one process keeps the suite deterministic here (ADR-0013).
const result = spawnSync(process.execPath, ["--test", "--test-isolation=none", ...files], {
  stdio: "inherit",
  cwd: ROOT,
  env: { ...process.env, GIDORAH_TEST: "1" },
});
if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
