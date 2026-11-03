/**
 * Real-service chaos test (M5 gate): start a real Bifrost gateway on a private
 * port, prove a request works, kill the gateway, and prove the agent gets a
 * clear provider error with no direct-provider fallback.
 *
 * Runs only where the built Bifrost binary exists (it is a local toolchain
 * artifact, not a committed file); the offline chaos suite covers the rest.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createBifrostClient } from "../../packages/bifrost/src/client.ts";

const ROOT = process.cwd();
const BINARY = join(ROOT, ".tools", "bifrost-bin", "bifrost-http.exe");
const APP_DIR = join(ROOT, ".tools", "bifrost-chaos");
const PORT = "8091";

function credentials(): Record<string, string> {
  const file = join(ROOT, ".tools", "credentials.env");
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
}

async function waitFor(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

if (existsSync(BINARY)) {
  test("real chaos: killing Bifrost yields a clear provider error and no fallback", async () => {
    mkdirSync(APP_DIR, { recursive: true });
    const config = readFileSync(join(ROOT, ".tools", "bifrost-app", "config.json"), "utf8");
    const fs = await import("node:fs");
    fs.writeFileSync(join(APP_DIR, "config.json"), config);
    const env = { ...process.env, FIREWORKS_API_KEY: credentials().FW_KEY ?? "", USERPROFILE: join(ROOT, ".tools", "home") };
    const server: ChildProcess = spawn(BINARY, ["-app-dir", APP_DIR, "-port", PORT, "-log-level", "error"], { env, stdio: "ignore" });
    try {
      const up = await waitFor(`http://127.0.0.1:${PORT}/`, 90_000);
      assert.equal(up, true, "Bifrost did not start on the chaos port");
      const client = createBifrostClient({ baseUrl: `http://127.0.0.1:${PORT}/openai`, virtualKey: "sk-bf-gidorah-cloud-dev", timeoutMs: 60_000 });
      const response = await client.complete({
        messages: [{ role: "user", content: "say hi" }],
        modelAlias: "fireworks/accounts/fireworks/models/deepseek-v4p1-flash",
        phase: "explore",
        sessionId: "chaos-real",
        confidential: false,
        maxTokens: 8,
      });
      assert.equal(response.routing.served.provider, "fireworks");

      server.kill();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await assert.rejects(
        () => client.complete({
          messages: [{ role: "user", content: "say hi" }],
          modelAlias: "fireworks/accounts/fireworks/models/deepseek-v4p1-flash",
          phase: "explore",
          sessionId: "chaos-real",
          confidential: false,
          maxTokens: 8,
        }),
        /Bifrost unreachable|ProviderError/,
      );
    } finally {
      server.kill();
    }
  });
}
