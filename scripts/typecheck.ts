/**
 * Typecheck.
 *
 * Runs the real TypeScript compiler when it is installed. This build installed
 * typescript and @types/node from the npm registry (through Node's fetch with a
 * local cache), so this is a real strict type check. If the toolchain is
 * absent, it fails honestly instead of pretending types were checked.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const tscJs = join(ROOT, "node_modules", "typescript", "lib", "tsc.js");

if (!existsSync(tscJs)) {
  console.error("typecheck: FAIL. TypeScript is not installed (node_modules/typescript missing).");
  console.error("typecheck: run `pnpm install` with registry access, then retry.");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(ROOT, "node_modules", "typescript", "package.json"), "utf8")) as { version: string };
console.log(`typecheck: tsc ${pkg.version} (strict, noEmit)`);
const result = spawnSync(process.execPath, [tscJs, "-p", "tsconfig.json", "--noEmit"], { stdio: "inherit", cwd: ROOT });
process.exit(result.status ?? 1);
