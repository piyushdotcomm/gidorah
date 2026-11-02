/**
 * DLP / policy inspection at the model boundary.
 *
 * This is the TypeScript twin of the Go Bifrost plugin in plugins/bifrost-dlp.
 * It runs in tests against the mock gateway, and it is the agent-side redactor
 * that the docs require as a defense-in-depth layer (policy-and-security.md
 * §4.6). The Go plugin is the gateway enforcement point when a real Bifrost is
 * available; it is not compiled in this offline build (PENDING).
 */
import { redactSecrets, scanSecrets, secretSummary } from "../../shared/src/redaction.ts";

export interface DlpOptions {
  confidential: boolean;
  defaultAction: "block" | "redact";
  allowlist?: string[];
}

export interface DlpDecision {
  action: "clean" | "blocked" | "redacted";
  classes: string[];
  hashes: string[];
  body: string;
  reason: string;
}

/** Inspect a serialized outbound request body before it can leave the machine. */
export function inspectOutbound(body: string, options: DlpOptions): DlpDecision {
  const matches = scanSecrets(body).filter((match) => !(options.allowlist ?? []).includes(match.class));
  if (matches.length === 0) {
    return { action: "clean", classes: [], hashes: [], body, reason: "no secret patterns" };
  }
  if (options.defaultAction === "redact") {
    const redacted = redactSecrets(body);
    return {
      action: "redacted",
      classes: redacted.classes,
      hashes: secretSummary(matches).map((m) => m.hash),
      body: redacted.text,
      reason: `redacted ${matches.length} secret pattern(s)`,
    };
  }
  return {
    action: "blocked",
    classes: [...new Set(matches.map((m) => m.class))],
    hashes: secretSummary(matches).map((m) => m.hash),
    body,
    reason: `blocked ${matches.length} secret pattern(s) before cloud egress`,
  };
}

/**
 * Confidential guard: a request marked confidential may only be served by a
 * local provider. Returns true when the attempt must be rejected.
 */
export function violatesConfidentialGuard(confidential: boolean, provider: string): boolean {
  return confidential && !isLocalProvider(provider);
}

export function isLocalProvider(provider: string): boolean {
  return provider === "ollama" || provider.startsWith("ollama/") || provider === "local";
}
