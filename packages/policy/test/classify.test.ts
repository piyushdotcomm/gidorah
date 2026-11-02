import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { classifyRepo, remoteMatches } from "../src/classify.ts";
import { resolveAlias, selectVirtualKey } from "../src/keys.ts";
import { DEFAULT_POLICY, loadPolicy, policyFromRaw } from "../src/schema.ts";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "gidorah-policy-"));
}

test("classification: first confidential path match wins, default otherwise", () => {
  const dir = tempDir();
  try {
    const bank = join(dir, "bank-secret");
    const bankNested = join(bank, "sub");
    mkdirSync(bankNested, { recursive: true });
    const other = join(dir, "public-repo");
    mkdirSync(other, { recursive: true });

    const policy = policyFromRaw({
      mode: { default: "cloud", confidential: { paths: [join(dir, "bank-*")] } },
    });
    const confidential = classifyRepo(policy, bankNested);
    assert.equal(confidential.mode, "confidential");
    assert.match(confidential.ruleId, /confidential-path-0/);
    const cloud = classifyRepo(policy, other);
    assert.equal(cloud.mode, "cloud");
    assert.match(cloud.ruleId, /:default/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("classification: remote patterns and convenience marker", () => {
  const dir = tempDir();
  try {
    assert.equal(remoteMatches("git@github.com:acme/secret-*", "git@github.com:acme/secret-billing"), true);
    assert.equal(remoteMatches("git@github.com:acme/secret-*", "git@github.com:acme/public"), false);

    const policy = policyFromRaw({
      mode: { default: "cloud", confidential: { remotes: ["git@github.com:acme/secret-*"] } },
    });
    assert.equal(classifyRepo(policy, dir, "git@github.com:acme/secret-billing").mode, "confidential");

    mkdirSync(join(dir, ".gidorah"));
    writeFileSync(join(dir, ".gidorah", "confidential"), "");
    assert.equal(classifyRepo(policy, dir).mode, "confidential");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("classification: invalid policy fails closed", () => {
  const dir = tempDir();
  try {
    const file = join(dir, "policy.yml");
    writeFileSync(file, "version: 1\nmode:\n  default: definitely-not-a-mode\n");
    const result = loadPolicy(file);
    assert.equal(result.valid, false);
    assert.equal(result.policy.mode.default, "confidential");
    assert.equal(result.policy.research.enabled, false);
    assert.equal(result.policy.budgets.task.default_usd, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("virtual keys: confidential uses the local key; exhausted budget degrades per policy", () => {
  const policy = DEFAULT_POLICY;
  const confidentialRepo = classifyRepo(
    policyFromRaw({ mode: { default: "cloud", confidential: { paths: ["C:/work/bank-*"] } } }),
    "C:/work/bank-secret",
  );
  const selected = selectVirtualKey(policy, confidentialRepo, { usedUsd: 0, limitUsd: 10, remainingUsd: 10 });
  assert.equal(selected.kind, "local");
  assert.equal(selected.name, policy.budgets.llm.virtual_key_local);

  const cloudRepo = classifyRepo(policy, "C:/work/public");
  const broke = selectVirtualKey(policy, cloudRepo, { usedUsd: 10, limitUsd: 10, remainingUsd: 0 });
  assert.equal(broke.kind, "local");
  assert.match(broke.reason, /local_first/);

  const stopPolicy = {
    ...policy,
    budgets: { ...policy.budgets, llm: { ...policy.budgets.llm, at_limit: "stop" as const } },
  };
  assert.throws(() => selectVirtualKey(stopPolicy, cloudRepo, { usedUsd: 10, limitUsd: 10, remainingUsd: 0 }), /budget exhausted/i);
});

test("aliases resolve to provider/model and unknown aliases fail closed", () => {
  assert.deepEqual(resolveAlias(DEFAULT_POLICY, "gidorah-strong"), { provider: "deepseek", model: "deepseek-pro" });
  assert.throws(() => resolveAlias(DEFAULT_POLICY, "gidorah-nonexistent"), /Unknown model alias/);
});
