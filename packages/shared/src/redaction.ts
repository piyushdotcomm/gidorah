/**
 * Secret detection and redaction.
 *
 * Used in three places, all required by the docs:
 *  - agent-side redaction before constructing a model request (policy §4.6);
 *  - log/trace redaction so no secret reaches a file (NFR-06);
 *  - the red-team canary scan over every outbound request (audit §2.3).
 *
 * Detection only ever logs the pattern class and a short hash, never the value.
 */
import { sha256Hex } from "./canonical.ts";

export interface SecretMatch {
  class: string;
  hash: string;
  start: number;
  end: number;
}

interface Pattern {
  class: string;
  re: RegExp;
}

export const SECRET_PATTERNS: Pattern[] = [
  { class: "private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { class: "aws-access-key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { class: "openai-style-key", re: /\bsk-[A-Za-z0-9_-]{16,}\b/g },
  { class: "github-token", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g },
  { class: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { class: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { class: "tavily-key", re: /\btvly-[A-Za-z0-9-]{16,}\b/g },
  { class: "bifrost-virtual-key", re: /\bsk-bf-[A-Za-z0-9-]{8,}\b/g },
  { class: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { class: "bearer-token", re: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g },
  { class: "env-assignment", re: /\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)=["']?[A-Za-z0-9._~+/-]{20,}["']?/g },
];

function patternHash(value: string): string {
  return sha256Hex(value).slice(0, 12);
}

export function scanSecrets(text: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  for (const pattern of SECRET_PATTERNS) {
    pattern.re.lastIndex = 0;
    let match: RegExpExecArray | null = pattern.re.exec(text);
    while (match !== null) {
      matches.push({ class: pattern.class, hash: patternHash(match[0]), start: match.index, end: match.index + match[0].length });
      match = pattern.re.exec(text);
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}

export interface RedactionResult {
  text: string;
  classes: string[];
  count: number;
}

export function redactSecrets(text: string, replacement = "[REDACTED]"): RedactionResult {
  const matches = scanSecrets(text);
  if (matches.length === 0) return { text, classes: [], count: 0 };
  let out = "";
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    out += text.slice(cursor, match.start) + replacement;
    cursor = match.end;
  }
  out += text.slice(cursor);
  return { text: out, classes: [...new Set(matches.map((m) => m.class))], count: matches.length };
}

/** Class-and-hash-only summary, safe for logs and audit events. */
export function secretSummary(matches: SecretMatch[]): Array<{ class: string; hash: string }> {
  return matches.map((match) => ({ class: match.class, hash: match.hash }));
}

/**
 * Canary scan: returns the number of occurrences of the canary value in the
 * supplied outbound payload. The red team passes only at zero (audit §2.3).
 */
export function countCanaryOccurrences(payload: string, canary: string): number {
  if (canary.length < 8) throw new Error("Canary must be at least 8 characters");
  let count = 0;
  let index = payload.indexOf(canary);
  while (index !== -1) {
    count += 1;
    index = payload.indexOf(canary, index + canary.length);
  }
  return count;
}
