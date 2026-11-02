/**
 * Virtual key selection (bifrost-model-plane.md §4).
 *
 * The key is chosen by code, never by the model, and the model never sees it.
 * Bifrost still validates the key's provider allowlist before forwarding.
 */
import { PolicyDeniedError } from "../../shared/src/errors.ts";
import type { Policy, RepoClass } from "../../shared/src/types.ts";
import type { Classification } from "./classify.ts";

export interface BudgetState {
  usedUsd: number;
  limitUsd: number;
  remainingUsd: number;
}

export type VirtualKeyKind = "cloud" | "local";

export interface VirtualKeySelection {
  kind: VirtualKeyKind;
  name: string;
  reason: string;
}

export function selectVirtualKey(
  policy: Policy,
  classification: Classification,
  budget: BudgetState,
  options: { allowLocalFallback: boolean } = { allowLocalFallback: true },
): VirtualKeySelection {
  if (classification.mode === "confidential") {
    return {
      kind: "local",
      name: policy.budgets.llm.virtual_key_local,
      reason: `confidential (${classification.ruleId})`,
    };
  }
  if (budget.remainingUsd <= 0) {
    if (options.allowLocalFallback && policy.budgets.llm.at_limit === "local_first") {
      return {
        kind: "local",
        name: policy.budgets.llm.virtual_key_local,
        reason: "budget exhausted: local_first fallback",
      };
    }
    throw new PolicyDeniedError("LLM budget exhausted and local fallback is not allowed", {
      usedUsd: budget.usedUsd,
      limitUsd: budget.limitUsd,
    });
  }
  return { kind: "cloud", name: policy.budgets.llm.virtual_key_cloud, reason: "cloud mode, budget available" };
}

/** Map a virtual key to the providers it is allowed to reach. */
export function allowedProvidersFor(policy: Policy, kind: VirtualKeyKind): string[] {
  return kind === "local" ? policy.providers.local : policy.providers.cloud;
}

/** Resolve an alias to a concrete provider/model. Missing aliases fail closed. */
export function resolveAlias(policy: Policy, alias: string): { provider: string; model: string } {
  const target = policy.providers.aliases[alias];
  if (target === undefined) throw new PolicyDeniedError(`Unknown model alias: ${alias}`);
  const slash = target.indexOf("/");
  if (slash <= 0) throw new PolicyDeniedError(`Malformed alias target: ${target}`);
  return { provider: target.slice(0, slash), model: target.slice(slash + 1) };
}
