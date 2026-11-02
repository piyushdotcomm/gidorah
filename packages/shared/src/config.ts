/**
 * Runtime configuration and filesystem paths.
 *
 * Precedence (tech-stack-and-repo.md §5): CLI flags > env > config file >
 * defaults. Policy is separate and never repo-overridable.
 */
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { Mode } from "./types.ts";

export interface GidorahConfig {
  mode: Mode;
  home: string;
  user: string;
  logLevel: string;
  bifrost: { baseUrl: string; vkCloud: string; vkLocal: string };
  tavily: { apiKey: string };
  ollamaUrl: string;
  /** Mock mode uses in-process mock Bifrost/Tavily/Ollama; no network at all. */
  mocks: { providerLatencyMs: number };
}

export interface GidorahPaths {
  home: string;
  policyFile: string;
  configFile: string;
  sessionsDir: string;
  artifactsDir: string;
  researchDb: string;
  budgetDb: string;
  tracesDir: string;
  logsDir: string;
  anchorFile: string;
}

export function expandHome(path: string, home: string = homedir()): string {
  if (path === "~") return home;
  if (path.startsWith("~/") || path.startsWith("~\\")) return join(home, path.slice(2));
  return path;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GidorahConfig {
  const home = resolve(expandHome(env.GIDORAH_HOME ?? "~/.gidorah"));
  const vkCloud = env.BIFROST_VK_CLOUD ?? "";
  const vkLocal = env.BIFROST_VK_LOCAL ?? "";
  const tavilyKey = env.TAVILY_API_KEY ?? "";
  const explicit = env.GIDORAH_MODE;
  const mode: Mode = explicit === "cloud" || explicit === "confidential" || explicit === "mock"
    ? explicit
    : vkCloud !== "" && tavilyKey !== ""
      ? "cloud"
      : "mock";
  return {
    mode,
    home,
    user: env.GIDORAH_USER ?? env.USERNAME ?? env.USER ?? "local",
    logLevel: env.GIDORAH_LOG_LEVEL ?? "info",
    bifrost: {
      baseUrl: env.BIFROST_BASE_URL ?? "http://127.0.0.1:8080/openai",
      vkCloud,
      vkLocal,
    },
    tavily: { apiKey: tavilyKey },
    ollamaUrl: env.OLLAMA_URL ?? "http://127.0.0.1:11434",
    mocks: { providerLatencyMs: Number.parseInt(env.GIDORAH_MOCK_LATENCY_MS ?? "0", 10) },
  };
}

export function gidorahPaths(home: string): GidorahPaths {
  return {
    home,
    policyFile: join(home, "policy.yml"),
    configFile: join(home, "config.yml"),
    sessionsDir: join(home, "sessions"),
    artifactsDir: join(home, "artifacts"),
    researchDb: join(home, "cache", "research.db"),
    budgetDb: join(home, "cache", "budget.db"),
    tracesDir: join(home, "traces"),
    logsDir: join(home, "logs"),
    anchorFile: join(home, "audit-anchor.log"),
  };
}

export function ensureDirs(paths: GidorahPaths): void {
  for (const dir of [paths.home, paths.sessionsDir, paths.artifactsDir, paths.tracesDir, paths.logsDir, join(paths.home, "cache")]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}
