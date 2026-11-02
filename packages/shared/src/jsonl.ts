/** Append-only JSONL helpers: event logs, traces, benchmark raw rows. */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

export function appendJsonl(file: string, value: unknown): void {
  const dir = dirname(file);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(file, `${JSON.stringify(value)}\n`, "utf8");
}

export interface JsonlReadResult<T> {
  ok: boolean;
  items: T[];
  /** First corrupt line number (1-based) if ok is false. */
  badLine?: number;
  error?: string;
}

export function readJsonl<T>(file: string): JsonlReadResult<T> {
  if (!existsSync(file)) return { ok: true, items: [] };
  const text = readFileSync(file, "utf8");
  const items: T[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.trim() === "") continue;
    try {
      items.push(JSON.parse(line) as T);
    } catch {
      return { ok: false, items, badLine: i + 1, error: `Corrupt JSONL at line ${i + 1}` };
    }
  }
  return { ok: true, items };
}
