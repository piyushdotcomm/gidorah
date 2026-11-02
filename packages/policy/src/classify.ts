/**
 * Repository classification (policy-and-security.md §4.1).
 *
 * The global policy file is the root of trust. Paths and git remotes are
 * matched first-match-wins, explicit confidential beats the default, symlinks
 * are resolved, and the decision is logged with rule id and policy version.
 */
import { existsSync, realpathSync } from "node:fs";
import { join, normalize, resolve, sep } from "node:path";
import type { Policy, RepoClass } from "../../shared/src/types.ts";

export interface Classification {
  mode: RepoClass;
  ruleId: string;
  policyVersion: string;
  matched: string;
  normalizedCwd: string;
}

function canonicalize(path: string): string {
  const resolved = resolve(path);
  try {
    return existsSync(resolved) ? realpathSync.native(resolved) : resolved;
  } catch {
    return resolved;
  }
}

function normalizeForMatch(path: string): string {
  const value = normalize(path);
  return process.platform === "win32" ? value.toLowerCase() : value;
}

/** Convert a policy glob (`*` wildcard) into an anchored matcher for paths. */
export function pathMatches(pattern: string, cwd: string): boolean {
  const target = normalizeForMatch(cwd);
  const base = normalizeForMatch(pattern.replace(/[\\/]+$/, ""));
  if (!base.includes("*")) {
    return target === base || target.startsWith(base + (process.platform === "win32" ? "\\" : sep));
  }
  const escaped = base
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}(?:[\\\\/].*)?$`).test(target);
}

export function remoteMatches(pattern: string, remote: string): boolean {
  if (pattern === "") return false;
  const normalizedRemote = remote.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();
  if (!normalizedPattern.includes("*")) {
    return normalizedRemote === normalizedPattern || normalizedRemote.startsWith(normalizedPattern.replace(/\.git$/, ""));
  }
  const escaped = normalizedPattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`).test(normalizedRemote);
}

export function classifyRepo(policy: Policy, cwd: string, remote?: string): Classification {
  const normalizedCwd = canonicalize(cwd);
  const ruleIdPrefix = `policy-${policy.version}`;

  for (const [index, pattern] of policy.mode.confidential.paths.entries()) {
    if (pathMatches(pattern, normalizedCwd)) {
      return {
        mode: "confidential",
        ruleId: `${ruleIdPrefix}:confidential-path-${index}`,
        policyVersion: String(policy.version),
        matched: pattern,
        normalizedCwd,
      };
    }
  }

  if (remote !== undefined && remote !== "") {
    for (const [index, pattern] of policy.mode.confidential.remotes.entries()) {
      if (remoteMatches(pattern, remote)) {
        return {
          mode: "confidential",
          ruleId: `${ruleIdPrefix}:confidential-remote-${index}`,
          policyVersion: String(policy.version),
          matched: pattern,
          normalizedCwd,
        };
      }
    }
  }

  // Convenience marker: not authoritative on its own, but a local signal.
  const marker = join(normalizedCwd, policy.mode.confidential.marker);
  if (existsSync(marker)) {
    return {
      mode: "confidential",
      ruleId: `${ruleIdPrefix}:confidential-marker`,
      policyVersion: String(policy.version),
      matched: policy.mode.confidential.marker,
      normalizedCwd,
    };
  }

  return {
    mode: policy.mode.default === "confidential" ? "confidential" : "cloud",
    ruleId: `${ruleIdPrefix}:default`,
    policyVersion: String(policy.version),
    matched: "default",
    normalizedCwd,
  };
}
