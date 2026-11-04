/**
 * Build a publishable npm tarball without relying on npm pack's prepack.
 * Produces .tools/gidorah-<version>.tgz from compiled dist + runtime assets.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as tar from "tar";

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** OneDrive/AV sometimes briefly locks freshly emitted files; retry reads. */
function readRetry(path: string): Buffer {
  let last: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return readFileSync(path);
    } catch (error) {
      last = error;
      sleep(150);
    }
  }
  throw last;
}

const root = process.cwd();
const compiled = spawnSync(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.build.json"], { stdio: "inherit" });
if (compiled.status !== 0) process.exit(compiled.status ?? 1);

const stage = join(root, ".tools", "pkg-stage");
rmSync(stage, { recursive: true, force: true });
const pkgDir = join(stage, "package");

function copyDir(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src)) {
    const from = join(src, entry);
    const to = join(dst, entry);
    if (statSync(from).isDirectory()) copyDir(from, to);
    else writeFileSync(to, readRetry(from));
  }
}

copyDir(join(root, "bin"), join(pkgDir, "bin"));
copyDir(join(root, "dist"), join(pkgDir, "dist"));
copyDir(join(root, "config"), join(pkgDir, "config"));
mkdirSync(join(pkgDir, "tests", "replay"), { recursive: true });
mkdirSync(join(pkgDir, "third_party"), { recursive: true });
for (const file of ["LICENSE", "NOTICE", "README.md"]) writeFileSync(join(pkgDir, file), readRetry(join(root, file)));
writeFileSync(join(pkgDir, "tests", "replay", "demo.jsonl"), readRetry(join(root, "tests", "replay", "demo.jsonl")));
for (const file of ["opentui.LICENSE", "pi-tui.LICENSE"]) writeFileSync(join(pkgDir, "third_party", file), readRetry(join(root, "third_party", file)));

const pkg = JSON.parse(readRetry(join(root, "package.json")).toString("utf8")) as Record<string, unknown> & { version: string; scripts?: Record<string, string> };
delete pkg.scripts?.prepack;
writeFileSync(join(pkgDir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

const output = join(root, ".tools", `gidorah-${pkg.version}.tgz`);
rmSync(output, { force: true });
await tar.c({ gzip: true, file: output, cwd: stage }, ["package"]);
console.log(`wrote ${output}`);
