/**
 * Build check.
 *
 * The offline environment has no bundler and no TypeScript compiler (no
 * registry access), so the runtime executes TypeScript directly through
 * Node's built-in type stripping. "build" therefore validates the module
 * graph: every package entrypoint and the CLI entrypoint must load cleanly.
 * A real tsc/tsdown build is PENDING: requires registry access (ADR-0013).
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const packageDirs = readdirSync(join(ROOT, "packages"))
  .filter((p) => existsSync(join(ROOT, "packages", p, "package.json")))
  .map((p) => join(ROOT, "packages", p));
const appDirs = readdirSync(join(ROOT, "apps"))
  .filter((p) => existsSync(join(ROOT, "apps", p, "package.json")))
  .map((p) => join(ROOT, "apps", p));

let modules = 0;
for (const dir of [...packageDirs, ...appDirs]) {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name: string; license?: string; private?: boolean };
  if (pkg.license !== "Apache-2.0") {
    console.error(`FAIL ${pkg.name}: package license must be Apache-2.0, got ${pkg.license ?? "none"}`);
    process.exit(1);
  }
  const entry = join(dir, "src", "index.ts");
  if (!existsSync(entry)) {
    console.error(`FAIL ${pkg.name}: missing src/index.ts`);
    process.exit(1);
  }
  await import(pathToFileURL(entry).href);
  modules += 1;
}

function readCommit(): string {
  try {
    const head = readFileSync(join(ROOT, ".git", "HEAD"), "utf8").trim();
    if (!head.startsWith("ref: ")) return head.slice(0, 7);
    const ref = head.slice(5).trim();
    const direct = join(ROOT, ".git", ref);
    if (existsSync(direct)) return readFileSync(direct, "utf8").trim().slice(0, 7);
    const packed = join(ROOT, ".git", "packed-refs");
    if (existsSync(packed)) {
      const line = readFileSync(packed, "utf8").split("\n").find((entry) => entry.endsWith(` ${ref}`));
      if (line !== undefined) return line.slice(0, 7);
    }
    return "uncommitted";
  } catch {
    return "uncommitted";
  }
}
const commit = readCommit();

console.log(`build: ${modules} package/app entrypoints load (node ${process.version}, type stripping)`);
console.log(`build: commit ${commit}`);
console.log("build: bundled dist artifacts PENDING: requires tsc/tsdown from registry (ADR-0013)");
