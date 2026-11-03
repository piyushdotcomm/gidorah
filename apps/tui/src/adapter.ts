/**
 * TUI adapter (docs/01-architecture/tui-adaptation.md).
 *
 * Maps the Gidorah event stream to view models: status line, transcript,
 * approval modal, takeover banner, research card, DLP notice, Docs Guard badge,
 * trace table, and receipt. It never calls Bifrost or Tavily directly and never
 * reads the session file; it is a pure projection of TuiEvent.
 */
import { renderTuiEvent } from "../../../packages/core/src/replay.ts";
import type { EvidenceCard, Receipt, TraceRecord, TuiEvent } from "../../../packages/shared/src/types.ts";
import { statusLine, type StatusState } from "./index.ts";

export interface TuiModel {
  status: StatusState;
  transcript: string[];
  approval: { approvalId: string; tool: string; risk: string; preview: string } | null;
  banners: Array<{ from: string; to: string; reason: string; fallbackIndex?: number }>;
  cards: EvidenceCard[];
  dlpNotices: Array<{ class: string; action: "blocked" | "redacted" }>;
  docsChecks: Array<{ result: string; symbols?: string[] }>;
  receipts: Receipt[];
  notices: Array<{ level: string; text: string }>;
}

export function createTuiModel(initial?: Partial<StatusState>): TuiModel {
  return {
    status: {
      mode: "cloud",
      route: "gidorah-auto",
      llmUsd: 0,
      llmLimit: 0.5,
      researchCredits: 0,
      researchLimit: 50,
      dlp: "clean",
      cacheHitRate: 0,
      contextPressure: 0,
      compaction: "off",
      ...initial,
    },
    transcript: [],
    approval: null,
    banners: [],
    cards: [],
    dlpNotices: [],
    docsChecks: [],
    receipts: [],
    notices: [],
  };
}

export class TuiAdapter {
  readonly model: TuiModel;

  constructor(initial?: Partial<StatusState>) {
    this.model = createTuiModel(initial);
  }

  apply(event: TuiEvent): void {
    switch (event.type) {
      case "assistant_delta":
        this.model.transcript.push(event.text);
        return;
      case "assistant_done":
        return;
      case "tool_call":
        this.model.transcript.push(renderTuiEvent(event));
        return;
      case "tool_result":
        this.model.transcript.push(renderTuiEvent(event));
        return;
      case "approval_request":
        this.model.approval = { approvalId: event.approvalId, tool: event.tool, risk: event.risk, preview: event.preview };
        return;
      case "approval_decision":
        this.model.approval = null;
        this.model.transcript.push(renderTuiEvent(event));
        return;
      case "route_changed":
        this.model.banners.push({ from: event.from, to: event.to, reason: event.reason, ...(event.fallbackIndex === undefined ? {} : { fallbackIndex: event.fallbackIndex }) });
        this.model.status.route = event.to;
        return;
      case "budget_updated":
        this.model.status.llmUsd = event.llmUsd;
        this.model.status.llmLimit = event.llmLimit;
        this.model.status.researchCredits = event.researchCredits;
        this.model.status.researchLimit = event.researchLimit;
        return;
      case "research_card":
        this.model.cards.push(event.card);
        return;
      case "dlp_blocked":
        this.model.dlpNotices.push({ class: event.class, action: event.action });
        this.model.status.dlp = event.action === "blocked" ? `blocked:${event.class}` : `redacted:${event.class}`;
        return;
      case "docs_check":
        this.model.docsChecks.push({ result: event.result, ...(event.symbols === undefined ? {} : { symbols: event.symbols }) });
        return;
      case "notice":
        this.model.notices.push({ level: event.level, text: event.text });
        this.model.transcript.push(renderTuiEvent(event));
        return;
      case "turn_done":
        this.model.receipts.push(event.receipt);
        this.model.transcript.push(renderTuiEvent(event));
        return;
    }
  }

  status(color = false): string {
    return statusLine(this.model.status, color);
  }

  /** Renders the required panels in a fixed order: banner, transcript, approval, cards, badges, receipt. */
  render(color = false): string {
    const lines: string[] = [this.status(color)];
    for (const banner of this.model.banners) {
      const index = banner.fallbackIndex === undefined ? "" : ` #${banner.fallbackIndex}`;
      lines.push(`[takeover] ${banner.from} -> ${banner.to} (${banner.reason})${index}`);
    }
    lines.push(...this.model.transcript);
    if (this.model.approval !== null) {
      lines.push(`[approval required] ${this.model.approval.tool} (${this.model.approval.risk}): ${this.model.approval.preview}`);
    }
    for (const card of this.model.cards) {
      lines.push(`[research] ${card.confidence} confidence, ${card.tokenEstimate} tokens, sources: ${card.sources.map((source) => source.domain).join(", ")}`);
    }
    for (const notice of this.model.dlpNotices) {
      lines.push(`[dlp ${notice.action}] ${notice.class}`);
    }
    for (const check of this.model.docsChecks) {
      lines.push(`[docs guard] ${check.result}${check.symbols === undefined ? "" : `: ${check.symbols.join(", ")}`}`);
    }
    for (const receipt of this.model.receipts) {
      lines.push(`[receipt] ${receipt.status} ${receipt.tokens.total} tokens $${receipt.llmCostUsd.toFixed(4)} ${receipt.fallbacks} fallback(s)`);
    }
    return lines.join("\n");
  }

  /** Flight recorder table, as rendered by `gidorah trace`. */
  renderTrace(records: TraceRecord[]): string {
    const header = "#  Phase     Requested            Served               Fallback  Cache  Tokens  Cost";
    const rows = records.map((record, index) =>
      [
        String(index + 1).padEnd(2),
        record.phase.padEnd(9),
        `${record.requested.provider}/${record.requested.model}`.padEnd(20),
        `${record.served.provider}/${record.served.model}`.padEnd(20),
        (record.fallback ? `yes #${record.fallbackIndex ?? 1}` : "no").padEnd(9),
        (record.cacheHit ? "yes" : "no").padEnd(6),
        String(record.tokens.total).padEnd(7),
        `$${record.costUsd.toFixed(6)}`,
      ].join("  "),
    );
    return [header, ...rows].join("\n");
  }
}
