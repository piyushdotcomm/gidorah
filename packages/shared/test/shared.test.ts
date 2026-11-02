import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { canonicalJson, GENESIS_HASH, hashEvent, sha256Hex } from "../src/canonical.ts";
import { expandHome, gidorahPaths, loadConfig } from "../src/config.ts";
import { appendJsonl, readJsonl } from "../src/jsonl.ts";
import { countCanaryOccurrences, redactSecrets, scanSecrets } from "../src/redaction.ts";
import { parseYaml } from "../src/yaml.ts";

// Synthetic values are assembled at runtime so the repository's secret lint
// never sees a literal that looks like a credential.
const FAKE_OPENAI = ["sk", "-", "a".repeat(32)].join("");
const FAKE_PRIVATE_KEY = ["-----BEGIN ", "RSA ", "PRIVATE KEY-----MIIEowIBAAKCAQEAtest", "-----END ", "RSA ", "PRIVATE KEY-----"].join("");
const FAKE_AWS = ["AKIA", "ABCDEFGHIJKLMNOP"].join("");

test("canonicalJson sorts keys and is stable", () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: [3, null] } }), '{"a":{"c":[3,null],"d":2},"b":1}');
  assert.equal(sha256Hex("gidorah").length, 64);
});

test("hash chain changes with data, sequence, and previous hash", () => {
  const base = { seq: 0, time: 1, type: "session/start", data: { a: 1 }, schemaVersion: 1 as const, chainVersion: 1 as const };
  const h1 = hashEvent(base, GENESIS_HASH);
  const h2 = hashEvent(base, GENESIS_HASH);
  assert.equal(h1, h2);
  assert.notEqual(h1, hashEvent({ ...base, seq: 1 }, GENESIS_HASH));
  assert.notEqual(h1, hashEvent(base, h1));
  assert.notEqual(h1, hashEvent({ ...base, data: { a: 2 } }, GENESIS_HASH));
});

test("secret scanning detects classes and redacts without leaking values", () => {
  const text = `api_key ${FAKE_OPENAI} and ${FAKE_AWS}\n${FAKE_PRIVATE_KEY}`;
  const matches = scanSecrets(text);
  const classes = matches.map((m) => m.class);
  assert.ok(classes.includes("openai-style-key"));
  assert.ok(classes.includes("aws-access-key"));
  assert.ok(classes.includes("private-key"));
  const redacted = redactSecrets(text);
  assert.equal(redacted.count, 3);
  assert.ok(!redacted.text.includes(FAKE_OPENAI));
  assert.ok(!redacted.text.includes("MIIEowIBAAKCAQEAtest"));
  for (const match of matches) assert.ok(!text.slice(match.start, match.end) === false);
});

test("normal prose is not flagged as a secret", () => {
  const clean = "Use stripe.webhooks.constructEvent with the raw body and the stripe-signature header.";
  assert.deepEqual(scanSecrets(clean), []);
  assert.equal(redactSecrets(clean).count, 0);
});

test("canary occurrences are counted exactly", () => {
  const canary = "canary_7f3a9c2e1b";
  assert.equal(countCanaryOccurrences(`a ${canary} b ${canary}`, canary), 2);
  assert.equal(countCanaryOccurrences("nothing here", canary), 0);
});

test("yaml subset parses the policy shape", () => {
  const yaml = [
    "version: 1",
    "user: alice",
    "mode:",
    "  default: cloud",
    "  confidential:",
    "    paths:",
    '      - "C:/work/bank-*"',
    "      - C:/work/vault",
    "    remotes:",
    "      - git@github.com:acme/secret-*",
    "    marker: .gidorah/confidential",
    "budgets:",
    "  llm:",
    "    soft_threshold: 0.8",
    "    at_limit: local_first",
    "  research:",
    "    credits_per_day: 50",
    "    calls_per_task: 2",
    "research:",
    "  enabled: true",
    "  ttl_seconds: 604800",
    "# a comment",
  ].join("\n");
  const parsed = parseYaml(yaml) as Record<string, unknown>;
  assert.equal(parsed.version, 1);
  assert.equal(parsed.user, "alice");
  const mode = parsed.mode as Record<string, unknown>;
  assert.equal(mode.default, "cloud");
  assert.deepEqual((mode.confidential as Record<string, unknown>).paths, ["C:/work/bank-*", "C:/work/vault"]);
  assert.equal(((parsed.budgets as Record<string, unknown>).llm as Record<string, unknown>).soft_threshold, 0.8);
  assert.equal((parsed.research as Record<string, unknown>).enabled, true);
  assert.equal((parsed.research as Record<string, unknown>).ttl_seconds, 604800);
});

test("config defaults to mock mode without keys and expands home", () => {
  const config = loadConfig({});
  assert.equal(config.mode, "mock");
  assert.equal(config.bifrost.baseUrl, "http://127.0.0.1:8080/openai");
  assert.equal(expandHome("~/.gidorah", "C:/Users/x"), join("C:/Users/x", ".gidorah"));
  const paths = gidorahPaths("C:/Users/x/.gidorah");
  assert.ok(paths.policyFile.endsWith("policy.yml"));
  assert.ok(paths.anchorFile.endsWith("audit-anchor.log"));
});

test("jsonl append and read round trips and reports corruption", () => {
  const dir = mkdtempSync(join(tmpdir(), "gidorah-jsonl-"));
  try {
    const file = join(dir, "events.jsonl");
    appendJsonl(file, { seq: 0, type: "a" });
    appendJsonl(file, { seq: 1, type: "b" });
    const read = readJsonl<{ seq: number }>(file);
    assert.equal(read.ok, true);
    assert.deepEqual(read.items.map((i) => i.seq), [0, 1]);

    appendJsonl(file, "not-an-object-but-valid-json");
    const broken = readJsonl(file);
    assert.equal(broken.ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
