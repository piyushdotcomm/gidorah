/**
 * Typecheck.
 *
 * The TypeScript compiler (`tsc`) is not installed and cannot be installed
 * without registry access. This script runs tsc when it is available; when it
 * is not, it performs the strongest offline substitute: importing every source
 * module so syntax, import resolution, and top-level load errors surface, and
 * prints an explicit PENDING line instead of pretending types were checked.
 *
 * Both the PENDING status and the substitute are recorded in BUILD_STATUS.md
 * and ADR-0013. Nothing here lowers a real gate: when tsc exists, a type error
 * fails this script.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");

const probe = spawnSync(process.platform === "win32" ? "tsc.cmd" : "tsc", ["--version"], { shell: true, encoding: "utf8" });
if (probe.status === 0) {
  console.log(`typecheck: tsc found (${probe.stdout.trim()}), running strict project check`);
  const run = spawnSync(process.platform === "win32" ? "tsc.cmd" : "tsc", ["-p", "tsconfig.json", "--noEmit"], {
    shell: true,
    stdio: "inherit",
    cwd: ROOT,
  });
  process.exit(run.status ?? 1);
}

const modules: string[] = [];
for (const pkgDir of readdirSync(join(ROOT, "packages"))) {
  const entry = join(ROOT, "packages", pkgDir, "src", "index.ts");
  if (existsSync(entry)) modules.push(entry);
}
for (const appDir of readdirSync(join(ROOT, "apps"))) {
  const entry = join(ROOT, "apps", appDir, "src", "index.ts");
  if (existsSync(entry)) modules.push(entry);
}

for (const mod of modules) {
  await import(pathToFileURL(mod).href);
}

console.log(`typecheck: PENDING (tsc unavailable offline). Load-checked ${modules.length} source entrypoints.`);
console.log("typecheck: install the toolchain, then run `pnpm typecheck` for real type checking.");
