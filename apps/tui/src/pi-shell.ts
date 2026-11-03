/**
 * pi-tui shell for Gidorah (framework spike).
 *
 * Replaces the hand-rolled full-screen renderer: the transcript is a pi-tui
 * Container of Markdown/Text cards clipped by a scroll viewport, the composer is
 * pi-tui Editor, and approvals are a focus-capturing overlay. TUI's differential
 * renderer owns the terminal, so there is no manual clear/repaint loop.
 */
import {
  Container,
  Editor,
  Markdown,
  Spacer,
  Text,
  TUI,
  visibleWidth,
  type Component,
  type EditorTheme,
  type MarkdownTheme,
  type OverlayHandle,
  type SelectListTheme,
  type Terminal,
} from "@earendil-works/pi-tui";

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

function paint(color: boolean, code: string, text: string): string {
  return color ? `${code}${text}${ANSI.reset}` : text;
}

function isWide(codePoint: number): boolean {
  return (codePoint >= 0x1100 && codePoint <= 0x115f) || (codePoint >= 0x2e80 && codePoint <= 0xa4cf) || (codePoint >= 0xac00 && codePoint <= 0xd7a3) || (codePoint >= 0xf900 && codePoint <= 0xfaff) || (codePoint >= 0xff00 && codePoint <= 0xff60) || (codePoint >= 0x1f300 && codePoint <= 0x1faff);
}

/** Truncate styled text by visible width while preserving ANSI sequences. */
function truncateStyled(text: string, width: number): string {
  if (visibleWidth(text) <= width) return text;
  const target = Math.max(0, width - 1);
  let out = "";
  let used = 0;
  let i = 0;
  while (i < text.length) {
    if (text[i] === "\u001b") {
      const match = /^\u001b\[[0-9;?]*[ -/]*[@-~]/.exec(text.slice(i));
      if (match !== null) {
        out += match[0];
        i += match[0].length;
        continue;
      }
    }
    const char = String.fromCodePoint(text.codePointAt(i) ?? 32);
    const charWidth = isWide(text.codePointAt(i) ?? 0) ? 2 : 1;
    if (used + charWidth > target) break;
    out += char;
    used += charWidth;
    i += char.length;
  }
  return `${out}…${text.includes("\u001b") ? "\u001b[0m" : ""}`;
}

function padStyled(text: string, width: number): string {
  const clean = truncateStyled(text, width);
  return `${clean}${" ".repeat(Math.max(0, width - visibleWidth(clean)))}`;
}

export function makeThemes(color: boolean): { markdown: MarkdownTheme; editor: EditorTheme; select: SelectListTheme } {
  const c = (code: string) => (text: string) => paint(color, code, text);
  const plain = (text: string) => text;
  const select: SelectListTheme = {
    selectedPrefix: c(ANSI.cyan),
    selectedText: c(ANSI.bold),
    description: c(ANSI.dim),
    scrollInfo: c(ANSI.dim),
    noMatch: c(ANSI.dim),
  };
  return {
    markdown: {
      heading: c(ANSI.bold + ANSI.cyan),
      link: c(ANSI.cyan),
      linkUrl: c(ANSI.dim),
      code: c(ANSI.yellow),
      codeBlock: c(ANSI.dim),
      codeBlockBorder: c(ANSI.dim),
      quote: c(ANSI.dim),
      quoteBorder: c(ANSI.dim),
      hr: c(ANSI.dim),
      listBullet: c(ANSI.dim),
      bold: c(ANSI.bold),
      italic: c(ANSI.dim),
      strikethrough: c(ANSI.dim),
      underline: plain,
    },
    editor: { borderColor: c(ANSI.dim), selectList: select },
    select,
  };
}

/** Fixed few-line text block (header/status/footer). */
class LineView implements Component {
  private lines: string[] = [];
  private readonly color: boolean;
  constructor(color = false) {
    this.color = color;
  }
  setLines(lines: string[]): void {
    this.lines = lines;
  }
  invalidate(): void {}
  render(width: number): string[] {
    return this.lines.map((line) => truncateStyled(line, width));
  }
}

/** Clip a transcript component to a viewport height, with explicit scroll position. */
export class TranscriptViewport implements Component {
  private top = 0;
  private visibleRows = 0;
  private contentRows = 0;
  private followingTail = true;
  private readonly content: Component;
  private readonly height: (width: number) => number;

  constructor(content: Component, height: (width: number) => number) {
    this.content = content;
    this.height = height;
  }
  invalidate(): void {
    this.content.invalidate();
  }
  render(width: number): string[] {
    const lines = this.content.render(width);
    const height = Math.max(1, Math.floor(this.height(width)));
    const maximumTop = Math.max(0, lines.length - height);
    if (this.followingTail) this.top = maximumTop;
    else {
      this.top = Math.min(this.top, maximumTop);
      if (this.top === maximumTop) this.followingTail = true;
    }
    this.visibleRows = height;
    this.contentRows = lines.length;
    const visible = lines.slice(this.top, this.top + height);
    while (visible.length < height) visible.push("");
    return visible;
  }
  scrollRows(rows: number): void {
    const maximumTop = Math.max(0, this.contentRows - this.visibleRows);
    this.top = Math.max(0, Math.min(maximumTop, this.top + rows));
    this.followingTail = this.top === maximumTop;
  }
  page(direction: -1 | 1): void {
    this.scrollRows(direction * Math.max(1, this.visibleRows - 2));
  }
  followTail(): void {
    this.followingTail = true;
  }
}

export interface ToolCard {
  name: string;
  args: string;
  status: "running" | "ok" | "denied" | "error";
  elapsedMs?: number;
  result?: string;
  expanded?: boolean;
}

export interface ApprovalPayload {
  tool: string;
  risk: string;
  hint?: string;
  diff?: Array<{ kind: "path" | "context" | "remove" | "add"; text: string }>;
  queueCount?: number;
}

class ApprovalModal implements Component {
  private resolved = false;
  private readonly payload: ApprovalPayload;
  private readonly color: boolean;
  private readonly resolve: (decision: "allow" | "deny") => void;

  constructor(payload: ApprovalPayload, color: boolean, resolve: (decision: "allow" | "deny") => void) {
    this.payload = payload;
    this.color = color;
    this.resolve = resolve;
  }
  invalidate(): void {}
  render(width: number): string[] {
    const inner = Math.max(20, width - 4);
    const title = ` approval required (${this.payload.queueCount ?? 1} pending) `;
    const topFill = Math.max(0, width - 2 - title.length - 1);
    const top = `┌─${paint(this.color, ANSI.yellow, title)}${"─".repeat(topFill)}┐`;
    const lines: string[] = [top];
    const row = (text: string): void => {
      lines.push(`│ ${padStyled(text, inner)} │`);
    };
    row(`${paint(this.color, ANSI.bold, this.payload.tool)} ${paint(this.color, ANSI.dim, `(risk: ${this.payload.risk})`)}`);
    if (this.payload.hint !== undefined) row(paint(this.color, ANSI.dim, this.payload.hint));
    for (const [index, diff] of (this.payload.diff ?? []).slice(0, 14).entries()) {
      const prefix = diff.kind === "remove" ? "- " : diff.kind === "add" ? "+ " : diff.kind === "path" ? "@ " : "  ";
      const code = diff.kind === "remove" ? ANSI.red : diff.kind === "add" ? ANSI.green : ANSI.dim;
      const lineNo = diff.kind === "path" ? "   " : String(index).padStart(3);
      row(paint(this.color, code, `${lineNo} ${prefix}${diff.text}`));
    }
    if ((this.payload.diff?.length ?? 0) > 14) row(paint(this.color, ANSI.dim, `... ${(this.payload.diff?.length ?? 0) - 14} more lines`));
    row(paint(this.color, ANSI.dim, "[y] allow   [n] deny   [Esc] deny"));
    lines.push(`└${"─".repeat(Math.max(0, width - 2))}┘`);
    return lines;
  }
  handleInput(data: string): void {
    if (this.resolved) return;
    if (data === "y" || data === "Y") {
      this.resolved = true;
      this.resolve("allow");
    } else if (data === "n" || data === "N" || data === "\u001b") {
      this.resolved = true;
      this.resolve("deny");
    }
  }
}

export interface PickerItem {
  label: string;
  value: string;
  description?: string;
}

class PickerModal implements Component {
  private readonly items: PickerItem[];
  private index = 0;
  private query = "";
  private readonly color: boolean;
  private readonly onSelect: (value: string) => void;
  private readonly onCancel: () => void;

  constructor(items: PickerItem[], color: boolean, onSelect: (value: string) => void, onCancel: () => void) {
    this.items = items;
    this.color = color;
    this.onSelect = onSelect;
    this.onCancel = onCancel;
  }

  invalidate(): void {}

  private filtered(): PickerItem[] {
    const query = this.query.trim().toLowerCase();
    return query === "" ? this.items : this.items.filter((item) => `${item.label} ${item.description ?? ""}`.toLowerCase().includes(query));
  }

  render(width: number): string[] {
    const items = this.filtered();
    this.index = Math.max(0, Math.min(items.length - 1, this.index));
    const lines: string[] = [paint(this.color, ANSI.bold, "Resume session"), `${paint(this.color, ANSI.dim, "search:")} ${this.query}${paint(this.color, ANSI.dim, "_")}`, paint(this.color, ANSI.dim, "─".repeat(Math.max(0, width)))];
    if (items.length === 0) lines.push(paint(this.color, ANSI.dim, "no matching sessions"));
    for (const [i, item] of items.slice(0, 12).entries()) {
      const prefix = i === this.index ? paint(this.color, ANSI.cyan, "› ") : "  ";
      lines.push(`${prefix}${truncateVisible(item.label, Math.max(8, width - 2))}`);
    }
    lines.push(paint(this.color, ANSI.dim, "↑/↓ select · type to search · Enter resume · Esc cancel"));
    return lines;
  }

  handleInput(data: string): void {
    const items = this.filtered();
    if (data === "\u001b[A" || data === "\u001bOA") {
      this.index = Math.max(0, this.index - 1);
      return;
    }
    if (data === "\u001b[B" || data === "\u001bOB") {
      this.index = Math.min(items.length - 1, this.index + 1);
      return;
    }
    if (data === "\r") {
      const item = items[this.index];
      if (item !== undefined) this.onSelect(item.value);
      return;
    }
    if (data === "\u001b") {
      this.onCancel();
      return;
    }
    if (data === "\u007f") {
      this.query = this.query.slice(0, -1);
      this.index = 0;
      return;
    }
    if (data.length === 1 && data >= " ") {
      this.query += data;
      this.index = 0;
    }
  }
}

function truncateVisible(text: string, width: number): string {
  return visibleWidth(text) <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`;
}
/** Centered content column: max 104 columns with 2-column outer padding. */
class Frame extends Container {
  override render(width: number): string[] {
    const contentWidth = Math.min(104, Math.max(20, width - 4));
    const pad = Math.max(0, Math.floor((width - contentWidth) / 2));
    return super.render(contentWidth).map((line) => `${" ".repeat(pad)}${line}`);
  }
}

/** Wrapped yellow banner (no ellipsis clipping). */
class Banner implements Component {
  private text = "";
  private readonly color: boolean;
  constructor(color: boolean) {
    this.color = color;
  }
  setText(text: string): void {
    this.text = text;
  }
  invalidate(): void {}
  render(width: number): string[] {
    if (this.text === "") return [];
    return new Text(this.text, 0, 0).render(width).map((line) => paint(this.color, ANSI.bold + ANSI.yellow, line));
  }
}

export interface ShellOptions {
  color?: boolean;
  onSubmit: (text: string) => void;
  onQuit: () => void;
  onInterrupt: () => void;
  onScroll: (direction: -1 | 1) => void;
}

export class GidorahShell {
  readonly tui: TUI;
  readonly editor: Editor;
  private readonly header: LineView;
  private readonly status: LineView;
  private readonly footer: LineView;
  private readonly banner: Banner;
  private readonly frame = new Frame();
  private readonly transcript = new Container();
  private readonly viewport: TranscriptViewport;
  private approval: OverlayHandle | null = null;
  private approvalModal: ApprovalModal | null = null;
  private picker: OverlayHandle | null = null;
  private pickerModal: PickerModal | null = null;
  private readonly removeInputListener: () => void;

  private readonly terminal: Terminal;
  private readonly options: ShellOptions;

  constructor(terminal: Terminal, options: ShellOptions) {
    this.terminal = terminal;
    this.options = options;
    const color = options.color === true;
    const themes = makeThemes(color);
    this.tui = new TUI(terminal);
    this.header = new LineView(color);
    this.status = new LineView(color);
    this.footer = new LineView(color);
    this.banner = new Banner(color);
    this.editor = new Editor(this.tui, themes.editor, { paddingX: 0 });
    this.editor.onSubmit = (text) => options.onSubmit(text);
    this.viewport = new TranscriptViewport(this.transcript, (width) => {
      const reserved = this.header.render(width).length + this.banner.render(width).length + this.status.render(width).length + this.footer.render(width).length + this.editor.render(width).length + 2;
      return Math.max(1, terminal.rows - reserved);
    });
    this.frame.addChild(this.header);
    this.frame.addChild(this.banner);
    this.frame.addChild(this.status);
    this.frame.addChild(this.viewport);
    this.frame.addChild(new Spacer(1));
    this.frame.addChild(this.editor);
    this.frame.addChild(this.footer);
    this.tui.addChild(this.frame);
    this.tui.setFocus(this.editor);
    this.removeInputListener = this.tui.addInputListener((data) => {
      if (data === "\u0003") {
        options.onInterrupt();
        return { consume: true };
      }
      if (data === "\u0004") {
        options.onQuit();
        return { consume: true };
      }
      if (data === "\u000c") {
        this.tui.invalidate();
        this.tui.requestRender(true);
        return { consume: true };
      }
      if (data === "\u001b[5~") {
        options.onScroll(-1);
        return { consume: true };
      }
      if (data === "\u001b[6~") {
        options.onScroll(1);
        return { consume: true };
      }
      return undefined;
    });
  }

  setHeader(lines: string[]): void {
    this.header.setLines(lines);
    this.tui.requestRender();
  }

  setBanner(text: string | null): void {
    this.banner.setText(text ?? "");
    this.tui.requestRender();
  }

  setStatus(line: string): void {
    this.status.setLines([line]);
    this.tui.requestRender();
  }

  setFooter(lines: string[]): void {
    this.footer.setLines(lines);
    this.tui.requestRender();
  }

  clearTranscript(): void {
    this.transcript.clear();
    this.viewport.followTail();
    this.tui.requestRender();
  }

  setTranscriptComponents(components: Component[]): void {
    this.transcript.clear();
    for (const component of components) this.transcript.addChild(component);
    this.viewport.followTail();
    this.tui.requestRender();
  }

  addText(text: string): void {
    this.transcript.addChild(new Text(text, 0, 0));
    this.viewport.followTail();
    this.tui.requestRender();
  }

  addMarkdown(text: string, color = false): void {
    this.transcript.addChild(new Markdown(text, 0, 0, makeThemes(color).markdown));
    this.viewport.followTail();
    this.tui.requestRender();
  }

  addToolCard(card: ToolCard): void {
    const color = this.options.color === true;
    const statusColor = card.status === "ok" ? ANSI.green : card.status === "running" ? ANSI.yellow : ANSI.red;
    const elapsed = card.elapsedMs === undefined ? "" : ` ${Math.round(card.elapsedMs)}ms`;
    const lines = [`${paint(color, statusColor, "⚙")} ${paint(color, ANSI.bold, card.name)} ${paint(color, ANSI.dim, card.args)} ${paint(color, statusColor, `[${card.status}${elapsed}]`)}`];
    if (card.result !== undefined && card.result !== "") {
      const resultLines = card.result.split("\n").slice(0, card.expanded === true ? 40 : 3);
      for (const line of resultLines) lines.push(`  ${paint(color, ANSI.dim, line)}`);
    }
    this.transcript.addChild(new Text(lines.join("\n"), 0, 0));
    this.viewport.followTail();
    this.tui.requestRender();
  }

  addReceipt(text: string): void {
    const color = this.options.color === true;
    this.transcript.addChild(new Text(paint(color, ANSI.green, `✓ receipt: ${text}`), 0, 0));
    this.viewport.followTail();
    this.tui.requestRender();
  }

  scrollRows(rows: number): void {
    this.viewport.scrollRows(rows);
    this.tui.requestRender();
  }

  page(direction: -1 | 1): void {
    this.viewport.page(direction);
    this.tui.requestRender();
  }

  followTail(): void {
    this.viewport.followTail();
    this.tui.requestRender();
  }

  showApproval(payload: ApprovalPayload, resolve: (decision: "allow" | "deny") => void): void {
    this.hideApproval();
    this.approvalModal = new ApprovalModal(payload, this.options.color === true, (decision) => {
      this.hideApproval();
      this.tui.setFocus(this.editor);
      resolve(decision);
    });
    this.approval = this.tui.showOverlay(this.approvalModal, { width: "80%", maxHeight: "60%", anchor: "center", margin: 1 });
    this.tui.setFocus(this.approvalModal);
  }

  showPicker(items: PickerItem[], onSelect: (value: string) => void, onCancel: () => void): void {
    this.hidePicker();
    this.pickerModal = new PickerModal(items, this.options.color === true, (value) => {
      this.hidePicker();
      onSelect(value);
    }, () => {
      this.hidePicker();
      onCancel();
    });
    this.picker = this.tui.showOverlay(this.pickerModal, { width: "70%", maxHeight: "60%", anchor: "center", margin: 1 });
    this.tui.setFocus(this.pickerModal);
  }

  hidePicker(): void {
    this.picker?.hide();
    this.picker = null;
    this.pickerModal = null;
    this.tui.setFocus(this.editor);
    this.tui.requestRender();
  }

  hasPicker(): boolean {
    return this.pickerModal !== null;
  }

  hasApproval(): boolean {
    return this.approvalModal !== null;
  }

  hideApproval(): void {
    this.approval?.hide();
    this.approval = null;
    this.approvalModal = null;
    if (!this.pickerModal) this.tui.setFocus(this.editor);
    this.tui.requestRender();
  }

  getEditorText(): string {
    return this.editor.getText();
  }

  setEditorText(text: string): void {
    this.editor.setText(text);
  }

  focusEditor(): void {
    this.tui.setFocus(this.editor);
  }

  start(): void {
    this.tui.start();
  }

  stop(): void {
    this.hidePicker();
    this.hideApproval();
    this.removeInputListener();
    this.tui.stop();
  }

  /** Deterministic frame for tests/demo: framework component render, no ANSI. */
  snapshot(width: number, height: number): string {
    const header = this.header.render(width);
    const banner = this.banner.render(width);
    const status = this.status.render(width);
    const body = this.transcript.render(width);
    const text = this.editor.getText();
    const composer = text === "" ? "› Type a task, /help for commands" : `› ${text}`;
    const composerLines = new Text(composer, 0, 0).render(width);
    const footer = this.footer.render(width);
    const approvalLines = this.approvalModal === null ? [] : this.approvalModal.render(width);
    const pickerLines = this.pickerModal === null ? [] : this.pickerModal.render(width);
    const lines = [...header, ...banner, ...status, ...body, ...approvalLines, ...pickerLines, ...composerLines, ...footer];
    return lines.slice(-Math.max(1, height)).join("\n");
  }
}

export { LineView };
