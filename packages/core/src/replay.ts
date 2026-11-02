/**
 * Replay: record the visible demo scenes as TuiEvents, then render them offline
 * with no network (FR-53, NFR-18). Replay is not a re-run of the model: it is a
 * deterministic projection of a recorded session, so the demo cannot fail on a
 * provider outage.
 */
import { appendJsonl, readJsonl } from "../../shared/src/jsonl.ts";
import type { TuiEvent } from "../../shared/src/types.ts";

export function writeReplay(file: string, events: TuiEvent[]): void {
  for (const event of events) appendJsonl(file, event);
}

export function readReplay(file: string): TuiEvent[] {
  const read = readJsonl<TuiEvent>(file);
  if (!read.ok) throw new Error(read.error ?? "corrupt replay trace");
  return read.items;
}

/** One-line plain rendering used by the offline replay and CI logs. */
export function renderTuiEvent(event: TuiEvent): string {
  switch (event.type) {
    case "assistant_delta":
      return event.text;
    case "assistant_done":
      return "";
    case "tool_call":
      return `  tool ${event.name}(${JSON.stringify(event.args).slice(0, 120)})`;
    case "tool_result":
      return `  ${event.ok ? "ok" : "error"} ${event.summary}`;
    case "approval_request":
      return `  approval required: ${event.tool} (${event.risk}) ${event.preview}`;
    case "approval_decision":
      return `  approval ${event.decision}`;
    case "route_changed":
      return `  route change: ${event.from} -> ${event.to} (${event.reason})`;
    case "budget_updated":
      return `  budget: $${event.llmUsd.toFixed(4)} / $${event.llmLimit.toFixed(2)} · research ${event.researchCredits}/${event.researchLimit}`;
    case "research_card":
      return `  research card (${event.card.tokenEstimate} tokens, ${event.card.confidence}): ${event.card.sources.map((source) => source.domain).join(", ")}`;
    case "dlp_blocked":
      return `  DLP ${event.action}: ${event.class}`;
    case "docs_check":
      return `  docs guard: ${event.result}`;
    case "notice":
      return `  [${event.level}] ${event.text}`;
    case "turn_done":
      return `  receipt: ${event.receipt.status} · ${event.receipt.tokens.total} tokens · $${event.receipt.llmCostUsd.toFixed(4)} · ${event.receipt.fallbacks} fallback(s)`;
  }
}
