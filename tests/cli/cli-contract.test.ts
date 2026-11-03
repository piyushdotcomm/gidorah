/**
 * CLI contract tests (docs/02-engineering/cli-contract.md).
 *
 * Spawns the real CLI through the sandbox-safe process runner (file-redirected
 * stdio) and asserts the contract: version/help exit 0, --json is machine-only,
 * --plain has no ANSI, completion scripts generate, piped/non-TTY runs never
 * prompt, --yes requires --sandbox, and headless emits JSON.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runProcess } from "../../packages/core/src/tools.ts";

const ROOT = process.cwd();
const MAIN = join(ROOT, "apps", "cli", "src", "main.ts");

function cli(args: string[], env: NodeJS.ProcessEnv = {}) {
  const home = mkdtempSync(join(tmpdir(), "gidorah-cli-"));
  return runProcess({
    command: process.execPath,
    args: [MAIN, ...args],
    cwd: ROOT,
    timeoutMs: 60_000,
    env: { ...process.env, GIDORAH_HOME: home, GIDORAH_MODE: "mock", ...env },
  });
}

test("CLI-01 --version exits 0 and prints a semver", async () => {
  const result = await cli(["--version"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test("CLI-02 --help exits 0 and lists the command tree", async () => {
  const result = await cli(["--help"]);
  assert.equal(result.code, 0);
  for (const command of ["run", "doctor", "audit", "redteam", "demo", "bench", "conformance", "chaos", "completion"]) {
    assert.ok(result.stdout.includes(command), `help is missing ${command}`);
  }
});

test("CLI-03 --json doctor writes only JSON to stdout", async () => {
  const result = await cli(["doctor", "--json"]);
  assert.equal(result.code, 0);
  const parsed = JSON.parse(result.stdout) as { ok: boolean; checks: unknown[] };
  assert.equal(parsed.ok, true);
  assert.ok(Array.isArray(parsed.checks));
});

test("CLI-04 --plain demo --replay contains no ANSI escapes", async () => {
  const result = await cli(["demo", "--replay", "--plain"]);
  assert.equal(result.code, 0);
  assert.equal(result.stdout.includes("\u001b"), false);
  assert.ok(result.stdout.includes("Gidorah"));
});

test("CLI-05 completion scripts generate for bash, zsh, fish", async () => {
  const bash = await cli(["completion", "bash"]);
  assert.equal(bash.code, 0);
  assert.ok(bash.stdout.includes("complete -F"));
  const zsh = await cli(["completion", "zsh"]);
  assert.equal(zsh.code, 0);
  assert.ok(zsh.stdout.includes("#compdef gidorah"));
  const fish = await cli(["completion", "fish"]);
  assert.equal(fish.code, 0);
  assert.ok(fish.stdout.includes("complete -c gidorah"));
  const bogus = await cli(["completion", "powershell"]);
  assert.equal(bogus.code, 2);
});

test("CLI-06 unknown commands exit 2 (usage)", async () => {
  const result = await cli(["definitely-not-a-command"]);
  assert.equal(result.code, 2);
});

test("CLI-07 --yes without --sandbox is rejected", async () => {
  const result = await cli(["run", "do something", "--yes"]);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /--sandbox/);
});

test("CLI-08 headless run emits one JSON object and never prompts", async () => {
  const result = await cli(["run", "say hello", "--headless"], { GIDORAH_MODE: "mock" });
  assert.equal(result.code, 0);
  const parsed = JSON.parse(result.stdout) as { status: string; receipt: { tokens: { total: number } } };
  assert.equal(parsed.status, "success");
  assert.ok(parsed.receipt.tokens.total > 0);
});

test("CLI-09 non-TTY invocation does not hang on prompts", async () => {
  const result = await cli(["doctor", "--plain"], { GIDORAH_MODE: "mock" });
  assert.equal(result.code, 0);
  assert.equal(result.timedOut, false);
});
