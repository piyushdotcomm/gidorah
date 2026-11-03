/**
 * Pure layout for the native TUI: header, status, transcript, approval panel,
 * input composer, footer. No I/O, no runtime imports beyond display helpers, so
 * the same functions are unit-testable with fixed width/height.
 */
import { sanitizeUntrusted, statusLine, type StatusState } from "./index.ts";

export interface ApprovalDiffLine {
  kind: "path" | "context" | "remove" | "add";
  text: string;
}

export interface ApprovalView {
  approvalId: string;
  tool: string;
  risk: string;
  preview: string;
  reason?: string;
  hint?: string;
  diff?: ApprovalDiffLine[];
}

export interface ToolView {
  callId: string;
  name: string;
  args: string;
  status: "running" | "ok" | "denied" | "error";
  result?: string;
  elapsedMs?: number;
  expanded?: boolean;
  startedAt?: number;
}

export type TranscriptItem =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string; streaming?: boolean }
  | { kind: "tool"; tool: ToolView }
  | { kind: "notice"; level: "info" | "warn" | "error"; text: string }
  | { kind: "research"; text: string; sources?: string[] }
  | { kind: "dlp"; text: string }
  | { kind: "docs"; text: string }
  | { kind: "takeover"; text: string }
  | { kind: "receipt"; text: string }
  | { kind: "error"; text: string }
  | { kind: "info"; text: string };

export interface TuiView {
  cwd: string;
  branch: string;
  sessionId: string;
  mode: string;
  modelAlias: string;
  status: StatusState;
  transcript: TranscriptItem[];
  input: string;
  cursor: number;
  approval: ApprovalView | null;
  phase: "idle" | "running" | "approval" | "exited";
  width: number;
  height: number;
  color: boolean;
  resumeOptions?: Array<{ id: string; label: string }> | null;
  resumeSelected?: number;
}

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  green: "\u001b[32m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m",
  magenta: "\u001b[35m",
} as const;

export function stripAnsi(text: string): string {
  return sanitizeUntrusted(text);
}

function isWide(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff)
  );
}

function isCombining(codePoint: number): boolean {
  return (codePoint >= 0x0300 && codePoint <= 0x036f) || (codePoint >= 0x200b && codePoint <= 0x200f) || (codePoint >= 0xfe00 && codePoint <= 0xfe0f);
}

export function displayWidth(text: string): number {
  let width = 0;
  for (const char of stripAnsi(text)) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined || codePoint < 32) continue;
    if (isCombining(codePoint)) continue;
    width += isWide(codePoint) ? 2 : 1;
  }
  return width;
}

export function truncate(text: string, width: number): string {
  const clean = stripAnsi(text);
  if (width <= 0) return "";
  if (displayWidth(clean) <= width) return clean;
  if (width === 1) return "…";
  let out = "";
  let used = 0;
  for (const char of clean) {
    const charWidth = isWide(char.codePointAt(0) ?? 0) ? 2 : 1;
    if (used + charWidth > width - 1) break;
    out += char;
    used += charWidth;
  }
  return `${out}…`;
}

export function padRight(text: string, width: number): string {
  const used = displayWidth(text);
  return used >= width ? truncate(text, width) : `${text}${" ".repeat(width - used)}`;
}

/** Word-aware wrap; hard-breaks words longer than the width. */
export function wrapText(text: string, width: number): string[] {
  const clean = stripAnsi(text).replace(/\r\n/g, "\n");
  const limit = Math.max(1, width);
  const lines: string[] = [];
  for (const paragraph of clean.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    let current = "";
    let currentWidth = 0;
    for (const word of paragraph.split(/(\s+)/)) {
      if (word === "") continue;
      const wordWidth = displayWidth(word);
      if (currentWidth + wordWidth <= limit) {
        current += word;
        currentWidth += wordWidth;
        continue;
      }
      if (current.trim() !== "") lines.push(current.trimEnd());
      current = "";
      currentWidth = 0;
      if (word.trim() === "") continue;
      if (wordWidth > limit) {
        let piece = "";
        let pieceWidth = 0;
        for (const char of word) {
          const charWidth = isWide(char.codePointAt(0) ?? 0) ? 2 : 1;
          if (pieceWidth + charWidth > limit) {
            lines.push(piece);
            piece = "";
            pieceWidth = 0;
          }
          piece += char;
          pieceWidth += charWidth;
        }
        current = piece;
        currentWidth = pieceWidth;
      } else {
        current = word;
        currentWidth = wordWidth;
      }
    }
    if (current !== "" || paragraph === "") lines.push(current.trimEnd());
  }
  return lines.length === 0 ? [""] : lines;
}

function paint(color: boolean, code: string, text: string): string {
  return color ? `${code}${text}${ANSI.reset}` : text;
}

function header(view: TuiView): string[] {
  const title = paint(view.color, ANSI.bold + ANSI.cyan, "Gidorah");
  return [
    `${title}  ${paint(view.color, ANSI.dim, "the governed coding agent")}`,
    truncate(
      `cwd: ${view.cwd}  ·  branch: ${view.branch}  ·  session: ${view.sessionId}  ·  mode: ${view.mode}  ·  model: ${view.modelAlias}`,
      view.width,
    ),
  ];
}

function summarizeArgs(value: unknown): string {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return truncate(text ?? "", 120);
  } catch {
    return "(unprintable arguments)";
  }
}

function toolLines(tool: ToolView, width: number, color: boolean): string[] {
  const statusColor = tool.status === "ok" ? ANSI.green : tool.status === "running" ? ANSI.yellow : ANSI.red;
  const elapsed = tool.elapsedMs === undefined ? "" : ` ${Math.round(tool.elapsedMs)}ms`;
  const head = `${paint(color, statusColor, "⚙")} ${paint(color, ANSI.bold, tool.name)}(${summarizeArgs(tool.args)}) ${paint(color, statusColor, `[${tool.status}${elapsed}]`)}`;
  const lines = wrapText(head, width).map((line) => truncate(line, width));
  if (tool.result !== undefined && tool.result !== "") {
    const limit = tool.expanded === true ? 40 : 4;
    const resultLines = wrapText(tool.result, Math.max(20, width - 4)).slice(0, limit);
    for (const line of resultLines) lines.push(`  ${paint(color, ANSI.dim, truncate(line, width - 2))}`);
    if (tool.expanded !== true && wrapText(tool.result, Math.max(20, width - 4)).length > limit) {
      lines.push(`  ${paint(color, ANSI.dim, "… (Ctrl+O expands)")}`);
    }
  }
  return lines;
}

export function transcriptLines(item: TranscriptItem, width: number, color: boolean): string[] {
  switch (item.kind) {
    case "user":
      return wrapText(`› ${item.text}`, width).map((line) => paint(color, ANSI.green, truncate(line, width)));
    case "assistant":
      return wrapText(`● ${item.text}${item.streaming === true ? " ▍" : ""}`, width).map((line) => truncate(line, width));
    case "tool":
      return toolLines(item.tool, width, color);
    case "notice":
      return wrapText(`! ${item.text}`, width).map((line) => paint(color, item.level === "error" ? ANSI.red : ANSI.yellow, truncate(line, width)));
    case "research":
      return [
        paint(color, ANSI.cyan, truncate(`≈ research: ${item.text.replace(/\n+/g, " ")}`, width)),
        ...(item.sources === undefined ? [] : [paint(color, ANSI.dim, truncate(`  sources: ${item.sources.join(", ")}`, width))]),
      ];
    case "dlp":
      return [paint(color, ANSI.red, truncate(`⛨ dlp: ${item.text}`, width))];
    case "docs":
      return [paint(color, ANSI.magenta, truncate(`✎ docs guard: ${item.text}`, width))];
    case "takeover":
      return [paint(color, ANSI.yellow, truncate(`⇄ takeover: ${item.text}`, width))];
    case "receipt":
      return [paint(color, ANSI.green, truncate(`✓ receipt: ${item.text}`, width))];
    case "error":
      return wrapText(`✖ ${item.text}`, width).map((line) => paint(color, ANSI.red, truncate(line, width)));
    case "info":
      return wrapText(`· ${item.text}`, width).map((line) => paint(color, ANSI.dim, truncate(line, width)));
  }
}

function renderApproval(approval: ApprovalView, width: number, color: boolean): string[] {
  const inner = Math.max(20, width - 4);
  const lines: string[] = [];
  lines.push(paint(color, ANSI.yellow, "┌─ approval required " + "─".repeat(Math.max(0, width - 21))));
  lines.push(`│ ${paint(color, ANSI.bold, approval.tool)} ${paint(color, ANSI.dim, `(risk: ${approval.risk})`)}`);
  if (approval.hint !== undefined && approval.hint !== "") {
    lines.push(`│ ${paint(color, ANSI.dim, truncate(approval.hint, inner))}`);
  }
  if (approval.diff !== undefined && approval.diff.length > 0) {
    const max = 14;
    for (const [index, diff] of approval.diff.slice(0, max).entries()) {
      const prefix = diff.kind === "remove" ? "- " : diff.kind === "add" ? "+ " : diff.kind === "path" ? "@ " : "  ";
      const code = diff.kind === "remove" ? ANSI.red : diff.kind === "add" ? ANSI.green : ANSI.dim;
      const lineNo = diff.kind === "path" ? "   " : String(index).padStart(3);
      lines.push(`│ ${paint(color, code, truncate(`${lineNo} ${prefix}${diff.text}`, inner))}`);
    }
    if (approval.diff.length > max) lines.push(`│ ${paint(color, ANSI.dim, `... ${approval.diff.length - max} more lines`)}`);
  } else {
    for (const line of wrapText(approval.preview, inner).slice(0, 8)) lines.push(`│ ${truncate(line, inner)}`);
  }
  lines.push(`│ ${paint(color, ANSI.dim, "[y] allow   [n] deny   [Esc] deny")}`);
  lines.push(paint(color, ANSI.yellow, "└" + "─".repeat(Math.max(0, width - 1))));
  return lines;
}

function renderInput(view: TuiView): string {
  const prefix = "› ";
  const input = stripAnsi(view.input);
  const cursor = Math.max(0, Math.min(view.cursor, input.length));
  if (view.phase === "running") {
    const last = input.split("\n").at(-1) ?? "";
    return paint(view.color, ANSI.dim, `${prefix}${truncate(last, view.width - 2)}`);
  }
  if (input === "") {
    return `${prefix}${paint(view.color, ANSI.dim, "Type a task, /help for commands")}`;
  }
  const lines = input.split("\n");
  const visible = lines.slice(-3);
  const rendered: string[] = [];
  const firstVisibleOffset = input.length - visible.join("\n").length;
  for (const [index, line] of visible.entries()) {
    const isLast = index === visible.length - 1;
    const lead = index === 0 ? prefix : "  ";
    if (isLast) {
      const column = Math.max(0, Math.min(line.length, cursor - firstVisibleOffset - (index === 0 ? 0 : line.length + 1)));
      const before = line.slice(0, column);
      const at = line.slice(column, column + 1) || " ";
      const after = line.slice(column + 1);
      rendered.push(`${lead}${before}${paint(view.color, ANSI.bold + ANSI.cyan, at)}${after}`);
    } else {
      rendered.push(`${lead}${line}`);
    }
  }
  return rendered.join("\n");
}
function footer(view: TuiView): string {
  if (view.phase === "approval") return paint(view.color, ANSI.yellow, "[y] allow  [n] deny  [Esc] deny");
  if (view.phase === "running") return paint(view.color, ANSI.dim, "running…  Ctrl+C cancel  Ctrl+O expand tools  Ctrl+L clear");
  return paint(view.color, ANSI.dim, "Enter send  ↑↓ history  /help  Ctrl+D quit");
}

export function renderScreen(view: TuiView): string {
  const width = Math.max(40, Math.min(200, Math.round(view.width) || 100));
  const height = Math.max(12, Math.min(100, Math.round(view.height) || 30));
  const color = view.color;
  const approvalLines = view.approval === null ? [] : renderApproval(view.approval, width, color);
  const fixedLines = 2 + 1 + 1 + 1 + 1; // header, status, separator, input, footer
  const bodyBudget = Math.max(3, height - fixedLines - approvalLines.length - 2);

  const body: string[] = [];
  if (view.resumeOptions !== undefined && view.resumeOptions !== null && view.resumeOptions.length > 0) {
    body.push(paint(color, ANSI.cyan, "Sessions:"));
    for (const [index, option] of view.resumeOptions.entries()) {
      const marker = view.resumeSelected === index ? "›" : " ";
      body.push(truncate(`${marker} ${index + 1}. ${option.label}`, width));
    }
    body.push(paint(color, ANSI.dim, "Type a number and press Enter to resume, or Esc to cancel."));
  }
  for (const item of view.transcript) {
    for (const line of transcriptLines(item, width, color)) body.push(truncate(line, width));
  }
  const visibleBody = body.slice(-bodyBudget);

  const lines: string[] = [];
  lines.push(...header(view));
  lines.push(truncate(statusLine(view.status, color), width));
  lines.push(paint(color, ANSI.dim, "─".repeat(width)));
  lines.push(...visibleBody);
  while (lines.length < height - 1 - approvalLines.length - 2) lines.push("");
  if (approvalLines.length > 0) lines.push(...approvalLines);
  lines.push(...renderInput(view).split("\n"));
  lines.push(footer(view));
  return lines.slice(0, height).join("\n");
}

/** Renders the final screen without color, for demos and transcripts. */
export function renderSnapshot(view: TuiView): string {
  return renderScreen({ ...view, color: false });
}
