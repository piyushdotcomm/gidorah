/**
 * Plain renderer for the Gidorah TUI adapter.
 *
 * The docs plan to vendor the DeepSeek Harness terminal UI. That package cannot
 * be fetched offline, so v1 ships the mandated line-based renderer behind the
 * same TuiEvent contract; the adapted TUI is PENDING (ADR-0014, MORNING_RUNBOOK).
 * No ANSI is emitted unless stdout is a TTY and color is enabled.
 */
import { renderTuiEvent } from "../../../packages/core/src/replay.ts";
import type { TuiEvent } from "../../../packages/shared/src/types.ts";

export interface StatusState {
  mode: string;
  route: string;
  llmUsd: number;
  llmLimit: number;
  researchCredits: number;
  researchLimit: number;
  dlp: string;
  cacheHitRate: number;
  contextPressure: number;
  compaction: string;
}

const ANSI = {
  reset: "\u001b[0m",
  green: "\u001b[32m",
  cyan: "\u001b[36m",
  red: "\u001b[31m",
} as const;

export function statusLine(state: StatusState, color = false): string {
  const paint = (code: string, text: string): string => (color ? `${code}${text}${ANSI.reset}` : text);
  const mode = state.mode === "confidential" || state.mode === "local" ? paint(ANSI.green, state.mode) : paint(ANSI.cyan, state.mode);
  const dlp = state.dlp === "clean" ? paint(ANSI.green, "dlp: clean") : paint(ANSI.red, `dlp: ${state.dlp}`);
  return [
    `mode: ${mode}`,
    `route: ${state.route}`,
    `budget: $${state.llmUsd.toFixed(4)}/$${state.llmLimit.toFixed(2)}`,
    `research: ${state.researchCredits}/${state.researchLimit}`,
    dlp,
    `cache: ${Math.round(state.cacheHitRate * 100)}%`,
    `context: ${Math.round(state.contextPressure * 100)}%`,
    `compaction: ${state.compaction}`,
  ].join("  ");
}

export interface RenderOptions {
  color?: boolean;
  width?: number;
}

/** Strip ANSI escapes and C0 control characters from untrusted text (CT-21). */
export function sanitizeUntrusted(text: string): string {
  return text
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "");
}

export function renderEvents(events: TuiEvent[], options: RenderOptions = {}): string {
  const lines = events.map((event) => sanitizeUntrusted(renderTuiEvent(event))).filter((line) => line !== "");
  const banner = options.color === true ? `${ANSI.cyan}Gidorah${ANSI.reset} - the governed coding agent` : "Gidorah - the governed coding agent";
  return [banner, ...lines].join("\n");
}

export function colorFor(event: TuiEvent): "green" | "amber" | "red" | "cyan" | "dim" {
  if (event.type === "dlp_blocked") return "red";
  if (event.type === "route_changed") return "amber";
  if (event.type === "research_card") return "cyan";
  if (event.type === "budget_updated") return "amber";
  return "dim";
}

export { renderTuiEvent };
