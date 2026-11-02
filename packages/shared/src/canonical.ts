/**
 * Canonical JSON, SHA-256 hashing, and the session hash chain.
 *
 * Canonical form: recursive object-key sorting, no whitespace, JSON scalar
 * rules per RFC 8785 for the subset we serialize (no BigInt, no Map, no Date).
 * The audit chain hashes the canonical body plus the previous hash, so editing
 * or reordering an event breaks verification (ADR-0011).
 */
import { createHash } from "node:crypto";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON does not allow non-finite numbers");
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      if (item === undefined) continue;
      out[key] = canonicalize(item);
    }
    return out;
  }
  throw new TypeError(`Canonical JSON does not allow ${typeof value}`);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export const GENESIS_HASH = "GENESIS";

export interface HashableEvent {
  seq: number;
  time: number;
  type: string;
  data: unknown;
  schemaVersion: number;
  chainVersion: number;
}

/** hash = sha256(canonical(event without hash/prevHash) + prevHash). */
export function hashEvent(event: HashableEvent, prevHash: string): string {
  const body = canonicalJson({
    seq: event.seq,
    time: event.time,
    type: event.type,
    data: event.data,
    schemaVersion: event.schemaVersion,
    chainVersion: event.chainVersion,
  });
  return sha256Hex(body + prevHash);
}
