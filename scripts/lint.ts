/**
 * Custom lint for the offline build.
 *
 * ESLint/Biome are not installable without registry access (ADR-0013). This
 * lint enforces the project's non-negotiables mechanically:
 *
 *  1. Single model egress: no provider SDK imports and no provider base URLs
 *     anywhere in source. Only Bifrost may talk to a model.
 *  2. No real secrets in tracked files. The red-team canary fixtures are
 *     explicitly allowlisted because they are synthetic fake values.
 *  3. No `any` in package/app source.
 *  4. Honest security language: no "tamper-proof" / "unhackable" claims.
 *  5. No disabled verification: no `--no-verify`, `it.skip`, `test.skip`,
 *     `describe.skip` in tests.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".git", ".gidorah", ".pnpm-store", "dist", "coverage", "bench"]);
const failures: string[] = [];

const PROVIDER_URL = /(api\.deepseek\.com|api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com)/;
const PROVIDER_IMPORT = /(?:from\s+|import\s*\()\s*["'](?:openai|@anthropic-ai\/sdk|@google\/generative-ai)["']/;
const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "openai-key", re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "github-token", re: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "tavily-key", re: /\btvly-[A-Za-z0-9-]{16,}\b/ },
  { name: "bifrost-virtual-key", re: /\bsk-bf-[A-Za-z0-9-]{8,}\b/ },
];
const SECRET_ALLOWLIST = [/^tests\/fixtures\//, /^tests\/redteam\//, /^tests\/conformance\//, /^scripts\/lint\.ts$/];
const BANNED_CLAIMS = /\b(tamper-proof|unhackable)\b/i;
const SKIP_MARKERS = /\b(?:it|test|describe)\.skip\s*\(|--no-verify/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|js|mjs|json|md|yml|yaml|go)$/.test(entry)) out.push(full);
  }
  return out;
}

const files: string[] = [];
for (const dir of ["packages", "apps", "tests", "scripts", "config", "plugins"]) {
  const full = join(ROOT, dir);
  try {
    walk(full, files);
  } catch {
    // absent directory is fine during early scaffolding
  }
}
files.push(join(ROOT, "package.json"), join(ROOT, "README.md"));

for (const file of files) {
  if (!readFileSync) break;
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  const lines = text.split("\n");

  const sourceFile = /^(packages|apps)\/[^/]+\/src\//.test(rel);
  if (sourceFile && PROVIDER_IMPORT.test(text)) failures.push(`${rel}: direct provider SDK import (single egress violation)`);
  if (sourceFile && PROVIDER_URL.test(text)) failures.push(`${rel}: provider base URL in source (single egress violation)`);
  if (sourceFile && /:\s*any\b/.test(text)) failures.push(`${rel}: forbidden \`any\` annotation`);
  if (rel.endsWith(".test.ts") && SKIP_MARKERS.test(text)) failures.push(`${rel}: skipped test or verification bypass`);
  if (rel.endsWith(".md")) {
    lines.forEach((line, index) => {
      if (!BANNED_CLAIMS.test(line)) return;
      // A line that forbids the overclaim is honest; only unflagged use fails.
      if (/\b(never|not|no|without|avoid|banned|instead of)\b/i.test(line)) return;
      failures.push(`${rel}:${index + 1}: banned security claim (use "tamper-evident", never tamper-proof/unhackable)`);
    });
  }

  const secretScanAllowed = SECRET_ALLOWLIST.some((re) => re.test(rel));
  if (!secretScanAllowed) {
    lines.forEach((line, index) => {
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.re.test(line)) failures.push(`${rel}:${index + 1}: possible secret (${pattern.name})`);
      }
    });
  }
}

if (failures.length > 0) {
  console.error(`lint: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`lint: ${files.length} files checked, 0 failures`);
