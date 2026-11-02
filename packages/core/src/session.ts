/**
 * Append-only, hash-chained session store (data-and-events.md, ADR-0011).
 *
 * The session log is the source of truth. Every event carries seq, time, type,
 * data, schemaVersion, prevHash and hash; verification recomputes the chain and
 * reports the first broken link. A hash chain is tamper-evident, not
 * tamper-proof, and the head is anchored at turn boundaries.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { GENESIS_HASH, hashEvent, sha256Hex } from "../../shared/src/canonical.ts";
import { appendJsonl, readJsonl } from "../../shared/src/jsonl.ts";
import { redactSecrets } from "../../shared/src/redaction.ts";
import type { Mode, ModelMessage, SessionEvent, SessionEventType, SessionHeader } from "../../shared/src/types.ts";

export interface CreateSessionOptions {
  dir: string;
  cwd: string;
  user: string;
  mode: Mode;
  policyVersion: string;
  sessionId?: string;
  now?: () => number;
}

export interface ChainVerification {
  valid: boolean;
  count: number;
  head: string;
  brokenAt?: number;
  reason?: string;
}

export function verifyChain(events: readonly SessionEvent[]): ChainVerification {
  let prev = GENESIS_HASH;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    if (event.seq !== index) {
      return { valid: false, count: events.length, head: prev, brokenAt: index, reason: `seq ${event.seq} does not match index ${index}` };
    }
    if (event.prevHash !== prev) {
      return { valid: false, count: events.length, head: prev, brokenAt: index, reason: "prevHash does not match the previous event hash" };
    }
    const expected = hashEvent({ ...event, data: event.data }, prev);
    if (expected !== event.hash) {
      return { valid: false, count: events.length, head: prev, brokenAt: index, reason: "event hash mismatch (body edited)" };
    }
    prev = event.hash;
  }
  return { valid: true, count: events.length, head: prev };
}

export class Session {
  readonly header: SessionHeader;
  readonly file: string;
  private events: SessionEvent[] = [];
  private prevHash = GENESIS_HASH;
  private readonly now: () => number;

  private constructor(header: SessionHeader, file: string, now: () => number) {
    this.header = header;
    this.file = file;
    this.now = now;
  }

  static create(options: CreateSessionOptions): Session {
    const now = options.now ?? Date.now;
    const sessionId = options.sessionId ?? `ses_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const dir = join(options.dir, sessionId);
    mkdirSync(dir, { recursive: true });
    const header: SessionHeader = {
      sessionId,
      cwd: options.cwd,
      user: options.user,
      policyVersion: options.policyVersion,
      mode: options.mode,
      createdAt: now(),
    };
    const session = new Session(header, join(dir, "session.jsonl"), now);
    session.append("session/start", { ...header });
    return session;
  }

  static load(file: string, now: () => number = Date.now): Session {
    const read = readJsonl<SessionEvent>(file);
    if (!read.ok) throw new Error(read.error ?? "corrupt session log");
    if (read.items.length === 0) throw new Error("empty session log");
    const first = read.items[0]!;
    const header = first.data as SessionHeader;
    const session = new Session(header, file, now);
    session.events = read.items;
    const verification = verifyChain(read.items);
    if (!verification.valid) throw new Error(`session chain invalid at event ${verification.brokenAt}: ${verification.reason}`);
    session.prevHash = verification.head;
    return session;
  }

  append(type: SessionEventType, data: unknown): SessionEvent {
    const event: SessionEvent = {
      seq: this.events.length,
      time: this.now(),
      type,
      data,
      schemaVersion: 1,
      prevHash: this.prevHash,
      hash: "",
      chainVersion: 1,
    };
    event.hash = hashEvent({ ...event, data: event.data }, this.prevHash);
    this.prevHash = event.hash;
    this.events.push(event);
    appendJsonl(this.file, event);
    return event;
  }

  get all(): readonly SessionEvent[] {
    return this.events;
  }

  verify(): ChainVerification {
    return verifyChain(this.events);
  }

  /** Close a turn/step/tool that was open at crash time. */
  closeOpenBoundaries(): SessionEvent[] {
    const openTurns: number[] = [];
    const openSteps: number[] = [];
    const openTools = new Set<string>();
    for (const event of this.events) {
      const data = event.data as Record<string, unknown>;
      if (event.type === "turn/start") openTurns.push(data.turn as number);
      if (event.type === "turn/end") openTurns.pop();
      if (event.type === "step/start") openSteps.push(data.step as number);
      if (event.type === "step/end") openSteps.pop();
      if (event.type === "tool/call") openTools.add(data.callId as string);
      if (event.type === "tool/result") openTools.delete(data.callId as string);
    }
    const reopened: SessionEvent[] = [];
    for (const callId of openTools) reopened.push(this.append("tool/result", { callId, ok: false, error: { code: "INTERRUPTED", message: "tool call was interrupted" } }));
    if (openSteps.length > 0) reopened.push(this.append("step/end", { step: openSteps.at(-1), reason: "interrupted" }));
    if (openTurns.length > 0) reopened.push(this.append("turn/end", { turn: openTurns.at(-1), reason: "interrupted" }));
    return reopened;
  }

  deriveMessages(): ModelMessage[] {
    const messages: ModelMessage[] = [];
    for (const event of this.events) {
      const data = event.data as Record<string, unknown>;
      if (event.type === "user/message") {
        messages.push({ role: "user", content: String(data.content ?? "") });
      } else if (event.type === "assistant/message") {
        const toolCalls = Array.isArray(data.toolCalls) ? (data.toolCalls as ModelMessage["toolCalls"]) : undefined;
        messages.push({ role: "assistant", content: String(data.content ?? ""), ...(toolCalls === undefined ? {} : { toolCalls }) });
      } else if (event.type === "tool/result") {
        const content = Array.isArray(data.content) ? (data.content as Array<{ text?: string }>).map((block) => block.text ?? "").join("\n") : String(data.content ?? "");
        messages.push({ role: "tool", content: typeof content === "string" ? content : "", toolCallId: String(data.callId ?? "") });
      } else if (event.type === "system/message") {
        messages.push({ role: "system", content: String(data.content ?? "") });
      }
    }
    return messages;
  }
}

// ---------------------------------------------------------------------------
// Audit verification, anchoring, and redacted export
// ---------------------------------------------------------------------------

export function anchorHead(events: readonly SessionEvent[], anchorFile: string): { head: string; at: number; line: number } {
  const verification = verifyChain(events);
  const at = Date.now();
  appendJsonl(anchorFile, { sessionId: (events[0]?.data as SessionHeader | undefined)?.sessionId ?? "unknown", chainHead: verification.head, at });
  return { head: verification.head, at, line: verification.count };
}

export interface AuditBundle {
  sessionId: string;
  policyVersion: string;
  chain: { valid: boolean; head: string; anchor: string };
  routes: unknown[];
  approvals: unknown[];
  research: unknown[];
  dlp: unknown[];
  budget: unknown[];
  tests: { passed: boolean | null; patchHash: string | null };
  disclaimer: string;
}

export function buildAuditBundle(events: readonly SessionEvent[], options: { anchorPath?: string } = {}): AuditBundle {
  const verification = verifyChain(events);
  const header = (events[0]?.data ?? {}) as Partial<SessionHeader>;
  const routes: unknown[] = [];
  const approvals: unknown[] = [];
  const research: unknown[] = [];
  const dlp: unknown[] = [];
  const budget: unknown[] = [];
  for (const event of events) {
    if (event.type === "route/changed") routes.push(event.data);
    if (event.type === "approval/decision") approvals.push(event.data);
    if (event.type === "research/result" || event.type === "research/denied") research.push(event.data);
    if (event.type === "dlp/blocked") dlp.push(event.data);
    if (event.type === "budget/updated" || event.type === "budget/task") budget.push(event.data);
  }
  return {
    sessionId: header.sessionId ?? "unknown",
    policyVersion: header.policyVersion ?? "unknown",
    chain: { valid: verification.valid, head: verification.head, anchor: options.anchorPath ?? "not-anchored" },
    routes,
    approvals,
    research,
    dlp,
    budget,
    tests: { passed: null, patchHash: null },
    disclaimer: "Tamper-evident evidence, not a certification. A hash chain detects edits; it is not proof against an operator with write access.",
  };
}

export function exportAudit(events: readonly SessionEvent[], format: "json" | "markdown", options: { anchorPath?: string } = {}): string {
  const bundle = buildAuditBundle(events, options);
  if (format === "json") {
    return redactSecrets(JSON.stringify(bundle, null, 2)).text;
  }
  const lines = [
    "# Gidorah audit export",
    "",
    `- Session: ${bundle.sessionId}`,
    `- Policy version: ${bundle.policyVersion}`,
    `- Chain valid: ${bundle.chain.valid}`,
    `- Chain head: ${bundle.chain.head}`,
    `- Anchor: ${bundle.chain.anchor}`,
    `- Model route changes: ${bundle.routes.length}`,
    `- Approval decisions: ${bundle.approvals.length}`,
    `- Research events: ${bundle.research.length}`,
    `- DLP decisions: ${bundle.dlp.length}`,
    `- Budget events: ${bundle.budget.length}`,
    "",
    `> ${bundle.disclaimer}`,
    "",
  ];
  return redactSecrets(lines.join("\n")).text;
}

export function patchHash(content: string): string {
  return sha256Hex(content);
}
