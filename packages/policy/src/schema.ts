/**
 * Policy schema, defaults, and fail-closed loading.
 *
 * The policy file is the root of trust for classification, budgets, research,
 * and approvals. It lives outside the repository and the repo cannot override
 * it (policy-and-security.md §3). Invalid policy fails closed: reads only, no
 * cloud, no research (data-and-events.md §7).
 */
import { existsSync, readFileSync } from "node:fs";
import { ConfigError } from "../../shared/src/errors.ts";
import { parseYaml } from "../../shared/src/yaml.ts";
import type { ApprovalVerdict, Mode, Policy } from "../../shared/src/types.ts";

export const POLICY_VERSION = 1;

export const DEGRADED_POLICY: Policy = {
  version: POLICY_VERSION,
  user: "local",
  mode: { default: "confidential", confidential: { paths: [], remotes: [], marker: ".gidorah/confidential" } },
  budgets: {
    llm: { virtual_key_cloud: "gidorah-cloud", virtual_key_local: "gidorah-local", soft_threshold: 0.8, at_limit: "stop" },
    research: { credits_per_day: 0, calls_per_task: 0 },
    task: { default_usd: 0, on_limit: "stop" },
  },
  research: { enabled: false, official_domains: {}, ttl_seconds: 0, card_token_cap: 700 },
  docsGuard: { enabled: false, max_lookups_per_edit: 0, advisory_only: true },
  context: { tool_cap_tokens: 4000, clear_after_tool_results: 8, compact_at_pressure: 0.9, compaction: "off" },
  editing: { patch_first: true, require_reason_for_full_write: true },
  repoMap: { enabled: true, max_tokens: 2000 },
  audit: { enabled: true, anchor_path: "~/.gidorah/audit-anchor.log", sign_head: false },
  redteam: { enabled: false, corpus: "", canary_required: true },
  dlp: { enabled: true, default_action: "block", allowlist: [] },
  approvals: {
    reads: "allow",
    writes: "ask",
    shell: "ask",
    git_read: "allow",
    git_write: "ask",
    confidential_network: "deny",
  },
  providers: { aliases: {}, cloud: [], local: [] },
};

export const DEFAULT_POLICY: Policy = {
  ...DEGRADED_POLICY,
  mode: { default: "cloud", confidential: { paths: [], remotes: [], marker: ".gidorah/confidential" } },
  budgets: {
    llm: { virtual_key_cloud: "gidorah-cloud", virtual_key_local: "gidorah-local", soft_threshold: 0.8, at_limit: "local_first" },
    research: { credits_per_day: 50, calls_per_task: 2 },
    task: { default_usd: 0.1, on_limit: "ask" },
  },
  research: {
    enabled: true,
    official_domains: { "stripe.com": ["docs.stripe.com"], "nodejs.org": ["nodejs.org"] },
    ttl_seconds: 604800,
    card_token_cap: 700,
  },
  docsGuard: { enabled: true, max_lookups_per_edit: 1, advisory_only: true },
  context: { tool_cap_tokens: 4000, clear_after_tool_results: 8, compact_at_pressure: 0.9, compaction: "measured" },
  redteam: { enabled: true, corpus: "tests/redteam/corpus.ts", canary_required: true },
  providers: {
    aliases: {
      "gidorah-auto": "deepseek/deepseek-flash",
      "gidorah-fast": "deepseek/deepseek-flash",
      "gidorah-strong": "deepseek/deepseek-pro",
      "gidorah-local": "ollama/qwen2.5-coder:3b",
    },
    cloud: ["deepseek/deepseek-flash", "deepseek/deepseek-pro"],
    local: ["ollama/qwen2.5-coder:3b"],
  },
};

type Raw = Record<string, unknown>;

function str(value: unknown, path: string, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") throw new ConfigError(`policy.${path} must be a string`);
  return value;
}

function num(value: unknown, path: string, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ConfigError(`policy.${path} must be a number`);
  return value;
}

function bool(value: unknown, path: string, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new ConfigError(`policy.${path} must be a boolean`);
  return value;
}

function oneOf<T extends string>(value: unknown, path: string, options: readonly T[], fallback: T): T {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string" || !options.includes(value as T)) {
    throw new ConfigError(`policy.${path} must be one of ${options.join(", ")}`);
  }
  return value as T;
}

function map(value: unknown, path: string): Raw {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new ConfigError(`policy.${path} must be a mapping`);
  return value as Raw;
}

function list(value: unknown, path: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ConfigError(`policy.${path} must be a list of strings`);
  }
  return value as string[];
}

function verdict(value: unknown, path: string, fallback: ApprovalVerdict): ApprovalVerdict {
  return oneOf(value, path, ["allow", "ask", "deny"] as const, fallback);
}

/** Normalize a raw YAML/JSON policy document into the typed Policy. */
export function policyFromRaw(raw: Raw, fallback: Policy = DEFAULT_POLICY): Policy {
  const mode = map(raw.mode, "mode");
  const confidential = map(mode.confidential, "mode.confidential");
  const budgets = map(raw.budgets, "budgets");
  const llm = map(budgets.llm, "budgets.llm");
  const researchBudget = map(budgets.research, "budgets.research");
  const task = map(budgets.task, "budgets.task");
  const research = map(raw.research, "research");
  const docsGuard = map(raw.docs_guard ?? raw.docsGuard, "docs_guard");
  const context = map(raw.context, "context");
  const editing = map(raw.editing, "editing");
  const repoMap = map(raw.repo_map ?? raw.repoMap, "repo_map");
  const audit = map(raw.audit, "audit");
  const redteam = map(raw.redteam, "redteam");
  const dlp = map(raw.dlp, "dlp");
  const approvals = map(raw.approvals, "approvals");
  const providers = map(raw.providers, "providers");
  const aliases = map(providers.aliases, "providers.aliases");

  const domains: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(map(research.official_domains, "research.official_domains"))) {
    domains[key] = list(value, `research.official_domains.${key}`);
  }

  return {
    version: num(raw.version, "version", fallback.version),
    user: str(raw.user, "user", fallback.user),
    mode: {
      default: oneOf(mode.default, "mode.default", ["mock", "cloud", "confidential"] as const, fallback.mode.default) as Mode,
      confidential: {
        paths: list(confidential.paths, "mode.confidential.paths"),
        remotes: list(confidential.remotes, "mode.confidential.remotes"),
        marker: str(confidential.marker, "mode.confidential.marker", fallback.mode.confidential.marker),
      },
    },
    budgets: {
      llm: {
        virtual_key_cloud: str(llm.virtual_key_cloud, "budgets.llm.virtual_key_cloud", fallback.budgets.llm.virtual_key_cloud),
        virtual_key_local: str(llm.virtual_key_local, "budgets.llm.virtual_key_local", fallback.budgets.llm.virtual_key_local),
        soft_threshold: num(llm.soft_threshold, "budgets.llm.soft_threshold", fallback.budgets.llm.soft_threshold),
        at_limit: oneOf(llm.at_limit, "budgets.llm.at_limit", ["local_first", "stop"] as const, fallback.budgets.llm.at_limit),
      },
      research: {
        credits_per_day: num(researchBudget.credits_per_day, "budgets.research.credits_per_day", fallback.budgets.research.credits_per_day),
        calls_per_task: num(researchBudget.calls_per_task, "budgets.research.calls_per_task", fallback.budgets.research.calls_per_task),
      },
      task: {
        default_usd: num(task.default_usd, "budgets.task.default_usd", fallback.budgets.task.default_usd),
        on_limit: oneOf(task.on_limit, "budgets.task.on_limit", ["ask", "stop"] as const, fallback.budgets.task.on_limit),
      },
    },
    research: {
      enabled: bool(research.enabled, "research.enabled", fallback.research.enabled),
      official_domains: domains,
      ttl_seconds: num(research.ttl_seconds, "research.ttl_seconds", fallback.research.ttl_seconds),
      card_token_cap: num(research.card_token_cap, "research.card_token_cap", fallback.research.card_token_cap),
    },
    docsGuard: {
      enabled: bool(docsGuard.enabled, "docs_guard.enabled", fallback.docsGuard.enabled),
      max_lookups_per_edit: num(docsGuard.max_lookups_per_edit, "docs_guard.max_lookups_per_edit", fallback.docsGuard.max_lookups_per_edit),
      advisory_only: bool(docsGuard.advisory_only, "docs_guard.advisory_only", fallback.docsGuard.advisory_only),
    },
    context: {
      tool_cap_tokens: num(context.tool_cap_tokens, "context.tool_cap_tokens", fallback.context.tool_cap_tokens),
      clear_after_tool_results: num(
        context.clear_after_tool_results,
        "context.clear_after_tool_results",
        fallback.context.clear_after_tool_results,
      ),
      compact_at_pressure: num(context.compact_at_pressure, "context.compact_at_pressure", fallback.context.compact_at_pressure),
      compaction: oneOf(context.compaction, "context.compaction", ["off", "pressure", "measured"] as const, fallback.context.compaction),
    },
    editing: {
      patch_first: bool(editing.patch_first, "editing.patch_first", fallback.editing.patch_first),
      require_reason_for_full_write: bool(
        editing.require_reason_for_full_write,
        "editing.require_reason_for_full_write",
        fallback.editing.require_reason_for_full_write,
      ),
    },
    repoMap: {
      enabled: bool(repoMap.enabled, "repo_map.enabled", fallback.repoMap.enabled),
      max_tokens: num(repoMap.max_tokens, "repo_map.max_tokens", fallback.repoMap.max_tokens),
    },
    audit: {
      enabled: bool(audit.enabled, "audit.enabled", fallback.audit.enabled),
      anchor_path: str(audit.anchor_path, "audit.anchor_path", fallback.audit.anchor_path),
      sign_head: bool(audit.sign_head, "audit.sign_head", fallback.audit.sign_head),
    },
    redteam: {
      enabled: bool(redteam.enabled, "redteam.enabled", fallback.redteam.enabled),
      corpus: str(redteam.corpus, "redteam.corpus", fallback.redteam.corpus),
      canary_required: bool(redteam.canary_required, "redteam.canary_required", fallback.redteam.canary_required),
    },
    dlp: {
      enabled: bool(dlp.enabled, "dlp.enabled", fallback.dlp.enabled),
      default_action: oneOf(dlp.default_action, "dlp.default_action", ["block", "redact"] as const, fallback.dlp.default_action),
      allowlist: list(dlp.allowlist, "dlp.allowlist"),
    },
    approvals: {
      reads: verdict(approvals.reads, "approvals.reads", fallback.approvals.reads),
      writes: verdict(approvals.writes, "approvals.writes", fallback.approvals.writes),
      shell: verdict(approvals.shell, "approvals.shell", fallback.approvals.shell),
      git_read: verdict(approvals.git_read, "approvals.git_read", fallback.approvals.git_read),
      git_write: verdict(approvals.git_write, "approvals.git_write", fallback.approvals.git_write),
      confidential_network: verdict(
        approvals.confidential_network,
        "approvals.confidential_network",
        fallback.approvals.confidential_network,
      ),
    },
    providers: {
      aliases: Object.fromEntries(
        Object.entries(aliases).map(([key, value]) => {
          if (typeof value !== "string") throw new ConfigError(`policy.providers.aliases.${key} must be a string`);
          return [key, value];
        }),
      ),
      cloud: list(providers.cloud, "providers.cloud"),
      local: list(providers.local, "providers.local"),
    },
  };
}

export interface PolicyLoadResult {
  policy: Policy;
  valid: boolean;
  errors: string[];
  source: string;
}

/** Load a policy file; invalid or missing policy degrades instead of trusting anything. */
export function loadPolicy(file: string, fallback: Policy = DEFAULT_POLICY): PolicyLoadResult {
  if (!existsSync(file)) {
    return { policy: { ...fallback, user: fallback.user }, valid: true, errors: [], source: "default" };
  }
  try {
    const raw = parseYaml(readFileSync(file, "utf8"));
    const policy = policyFromRaw(raw, fallback);
    return { policy, valid: true, errors: [], source: file };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { policy: { ...DEGRADED_POLICY, user: fallback.user }, valid: false, errors: [message], source: file };
  }
}
