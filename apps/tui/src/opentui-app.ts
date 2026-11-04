/**
 * Gidorah TUI on OpenTUI (the framework used by opencode).
 *
 * Real layout engine (Yoga), styled boxes, scrollable transcript cards, a
 * bordered Textarea composer, mouse-clickable approval buttons, selectable
 * session picker, and native differential rendering.
 */
import {
  ASCIIFontRenderable,
  BoxRenderable,
  DiffRenderable,
  MarkdownRenderable,
  ScrollBoxRenderable,
  SelectRenderable,
  SyntaxStyle,
  TextareaRenderable,
  TextRenderable,
  createCliRenderer,
  RGBA,
  type CliRenderer,
  type KeyEvent,
} from "@opentui/core";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runTask, type ApprovalService, type BudgetSnapshot, type RuntimeDeps } from "../../../packages/core/src/runtime.ts";
import { Session } from "../../../packages/core/src/session.ts";
import type { Receipt, SessionEvent, TraceRecord } from "../../../packages/shared/src/types.ts";
import { InteractiveApprovalService } from "./approval.ts";
import { sanitizeUntrusted } from "./index.ts";
import type { TranscriptItem } from "./layout.ts";
import { listSessionEntries, replaySessionTranscript, type TuiHooks, type TuiSessionEntry } from "./app.ts";

export interface OpenTuiOptions {
  session: Session;
  createDeps: (session: Session, hooks: TuiHooks) => RuntimeDeps;
  createSession: () => Session;
  listSessions?: () => TuiSessionEntry[];
  loadSession: (id: string) => Session;
  budgetSnapshot: () => BudgetSnapshot;
  resetBudget?: () => void;
  cwd: string;
  branch: string;
  mode: string;
  modelAlias: string;
  availableAliases?: string[];
  theme?: string;
  researchLimit?: number;
  maxSteps?: number;
  historyFile?: string;
  color?: boolean;
  renderer?: CliRenderer;
}

interface Palette {
  bg: string;
  panel: string;
  panelAlt: string;
  border: string;
  text: string;
  dim: string;
  accent: string;
  purple: string;
  green: string;
  red: string;
  yellow: string;
  cyan: string;
  magenta: string;
}

const THEMES: Record<string, Palette> = {
  "tokyo-night": { bg: "#0b0e14", panel: "#11151f", panelAlt: "#151b27", border: "#273049", text: "#c0caf5", dim: "#565f89", accent: "#7aa2f7", purple: "#bb9af7", green: "#9ece6a", red: "#f7768e", yellow: "#e0af68", cyan: "#7dcfff", magenta: "#c678dd" },
  "catppuccin-mocha": { bg: "#1e1e2e", panel: "#181825", panelAlt: "#313244", border: "#45475a", text: "#cdd6f4", dim: "#6c7086", accent: "#89b4fa", purple: "#cba6f7", green: "#a6e3a1", red: "#f38ba8", yellow: "#f9e2af", cyan: "#89dceb", magenta: "#f5c2e7" },
  nord: { bg: "#2e3440", panel: "#3b4252", panelAlt: "#434c5e", border: "#4c566a", text: "#eceff4", dim: "#7b88a1", accent: "#88c0d0", purple: "#b48ead", green: "#a3be8c", red: "#bf616a", yellow: "#ebcb8b", cyan: "#8fbcbb", magenta: "#b48ead" },
  "gruvbox-dark": { bg: "#282828", panel: "#1d2021", panelAlt: "#32302f", border: "#504945", text: "#ebdbb2", dim: "#928374", accent: "#83a598", purple: "#d3869b", green: "#b8bb26", red: "#fb4934", yellow: "#fabd2f", cyan: "#8ec07c", magenta: "#d3869b" },
  light: { bg: "#f4f4f4", panel: "#ffffff", panelAlt: "#e9e9e9", border: "#c4c4c4", text: "#1f1f1f", dim: "#666666", accent: "#005f87", purple: "#7a3e9d", green: "#2e7d32", red: "#c62828", yellow: "#9a6700", cyan: "#00695c", magenta: "#8e24aa" },
};

let T: Palette = THEMES["tokyo-night"]!;
interface Item {
  kind: string;
  text: string;
  level?: string;
  tool?: { callId: string; name: string; args: Record<string, unknown>; status: string; elapsedMs?: number; result?: string; expanded?: boolean };
  sources?: string[];
  assistantCard?: MarkdownRenderable;
  toolBox?: BoxRenderable;
}

function sanitize(text: string): string {
  return sanitizeUntrusted(text);
}

function color(code: string): RGBA {
  return RGBA.fromInts(...(hexToRgb(code) as [number, number, number]));
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16)];
}

function firstText(data: Record<string, unknown>): string {
  if (Array.isArray(data.content)) {
    for (const block of data.content) {
      if (block !== null && typeof block === "object" && typeof (block as { text?: unknown }).text === "string") return (block as { text: string }).text;
    }
  }
  return "";
}

function formatRef(value: unknown): string {
  if (typeof value === "string") return value;
  if (value !== null && typeof value === "object") {
    const ref = value as { provider?: string; model?: string };
    if (ref.provider !== undefined && ref.model !== undefined) return `${ref.provider}/${ref.model}`;
  }
  return "unknown";
}

function unifiedDiff(path: string, find: string, replace: string): string {
  const removed = find.split("\n").map((line) => `-${line}`).join("\n");
  const added = replace.split("\n").map((line) => `+${line}`).join("\n");
  return `--- a/${path}\n+++ b/${path}\n@@ -1,${find.split("\n").length} +1,${replace.split("\n").length} @@\n${removed}\n${added}`;
}

export class OpenTuiApp {
  private readonly opts: OpenTuiOptions;
  private readonly renderer: CliRenderer;
  private readonly approvalService = new InteractiveApprovalService();
  private session: Session;
  private items: Item[] = [];
  private phase: "idle" | "running" | "approval" | "exited" = "idle";
  private abort: AbortController | null = null;
  private unsubscribe: (() => void) | null = null;
  private streaming: Item | null = null;
  private toolTimes = new Map<string, number>();
  private toolArgs = new Map<string, { name: string; args: Record<string, unknown> }>();
  private shownApprovalId: string | null = null;
  private receipts: Receipt[] = [];
  private trace: TraceRecord[] = [];
  private modelAlias: string;
  private modelOptions: string[];
  private llmUsd = 0;
  private llmLimit: number;
  private researchCredits = 0;
  private researchLimit: number;
  private dlp = "clean";
  private cacheHitRate = 0;
  private contextPressure = 0;
  private compaction = "off";
  private cacheRead = 0;
  private inputTokens = 0;
  private contextCap = 128_000;
  private history: string[];
  private themeName = "tokyo-night";
  private themeLayer!: BoxRenderable;
  private themePicker!: SelectRenderable;
  private themeNames: string[] = Object.keys(THEMES);
  private done: ((code: number) => void) | null = null;
  private renderTimer: NodeJS.Timeout | null = null;
  private activityTimer: NodeJS.Timeout | null = null;
  private activity = "thinking…";
  private activityStarted = 0;
  private spinner = 0;
  private exitArmed = false;

  // view
  private transcript!: ScrollBoxRenderable;
  private textarea!: TextareaRenderable;
  private badgeMode!: TextRenderable;
  private badgeModel!: TextRenderable;
  private banner!: BoxRenderable;
  private statusValues: TextRenderable[] = [];
  private activityBar!: BoxRenderable;
  private activityText!: TextRenderable;
  private approvalLayer!: BoxRenderable;
  private approvalTitle!: TextRenderable;
  private approvalBody!: BoxRenderable;
  private approvalAllow!: BoxRenderable;
  private approvalDeny!: BoxRenderable;
  private pickerLayer!: BoxRenderable;
  private picker!: SelectRenderable;
  private pickerItems: TuiSessionEntry[] = [];

  constructor(options: OpenTuiOptions, renderer: CliRenderer) {
    this.opts = options;
    this.renderer = renderer;
    this.session = options.session;
    this.modelAlias = options.modelAlias;
    this.modelOptions = options.availableAliases ?? [options.modelAlias];
    this.llmLimit = options.budgetSnapshot().limitUsd;
    this.researchLimit = options.researchLimit ?? 50;
    this.themeName = options.theme !== undefined && THEMES[options.theme] !== undefined ? options.theme : this.loadTheme();
    T = THEMES[this.themeName] ?? THEMES["tokyo-night"]!;
    this.history = this.loadHistory();
    for (const entry of this.history) this.textareaHistoryPush(entry);
    this.attach(this.session);
    this.mount();
    this.wireKeys();
  }

  static async run(options: OpenTuiOptions): Promise<number> {
    const renderer = options.renderer ?? (await createCliRenderer({ screenMode: "alternate-screen", exitOnCtrlC: false, targetFps: 30 }));
    const app = new OpenTuiApp(options, renderer);
    return new Promise((resolve) => {
      app.done = resolve;
    });
  }

  private textareaHistoryPush(_entry: string): void {
    // pi-tui history helper is unnecessary; composer history is handled by the textarea itself.
  }

  private mount(): void {
    const root = new BoxRenderable(this.renderer, {
      id: "root",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      backgroundColor: color(T.bg),
      paddingX: 2,
      paddingY: 0,
      gap: 0,
    });
    this.renderer.root.add(root);

    // Header
    const header = new BoxRenderable(this.renderer, { id: "header", width: "100%", flexShrink: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" });
    const brand = new BoxRenderable(this.renderer, { id: "brand", flexShrink: 0, flexDirection: "column" });
    const logo = new ASCIIFontRenderable(this.renderer, { id: "logo", flexShrink: 0, text: "GIDORAH", font: "block", color: [color(T.accent), color(T.purple), color(T.red)] });
    brand.add(logo);
    brand.add(new TextRenderable(this.renderer, { id: "tagline", content: "governed coding agent · Bifrost model plane × Tavily knowledge plane", fg: color(T.dim) }));
    const badge = new BoxRenderable(this.renderer, { id: "badge", flexDirection: "column", alignItems: "flex-end", gap: 0 });
    this.badgeMode = new TextRenderable(this.renderer, { id: "badge-mode", content: "", fg: color(T.yellow) });
    this.badgeModel = new TextRenderable(this.renderer, { id: "badge-model", content: "", fg: color(T.dim) });
    badge.add(this.badgeMode);
    badge.add(this.badgeModel);
    header.add(brand);
    header.add(badge);
    root.add(header);

    // Mock banner
    this.banner = new BoxRenderable(this.renderer, {
      id: "banner",
      width: "100%",
      border: true,
      borderStyle: "rounded",
      borderColor: color(T.yellow),
      backgroundColor: color("#2a2418"),
      paddingX: 1,
      height: 4,
      flexDirection: "column",
      title: " MOCK MODE ",
      titleColor: color(T.yellow),
    });
    this.banner.add(new TextRenderable(this.renderer, {
      id: "banner-text",
      width: "100%",
      wrapMode: "word",
      fg: color(T.yellow),
      content: "Synthetic replies — no real model call. Start Bifrost and set GIDORAH_MODE=cloud for real coding. Run `gidorah tui --demo` for the scripted demo.",
    }));
    this.banner.visible = this.opts.mode === "mock";
    root.add(this.banner);

    // Status pills (two compact rows so every pill stays visible)
    const status = new BoxRenderable(this.renderer, { id: "status", width: "100%", height: 2, flexShrink: 0, flexDirection: "column", gap: 0 });
    const allPills = this.statusPills();
    for (const rowPills of [allPills.slice(0, 4), allPills.slice(4)]) {
      const row = new BoxRenderable(this.renderer, { id: `status-row-${rowPills[0]?.[0] ?? "x"}`, flexDirection: "row", gap: 1, flexWrap: "wrap" });
      for (const [label, value, fg] of rowPills) {
        const pill = this.pill(label, value, fg);
        row.add(pill.box);
        this.statusValues.push(pill.valueText);
      }
      status.add(row);
    }
    root.add(status);
    // Transcript
    this.transcript = new ScrollBoxRenderable(this.renderer, {
      id: "transcript",
      width: "100%",
      flexGrow: 1,
      minHeight: 0,
      flexShrink: 1,
      border: true,
      borderStyle: "rounded",
      borderColor: color(T.border),
      backgroundColor: color(T.panel),
      paddingX: 1,
      stickyScroll: true,
      stickyStart: "bottom",
      scrollY: true,
      viewportCulling: true,
    });
    root.add(this.transcript);

    // Activity row
    this.activityBar = new BoxRenderable(this.renderer, { id: "activity", width: "100%", flexDirection: "row", gap: 1, visible: false });
    this.activityText = new TextRenderable(this.renderer, { id: "activity-text", content: "", fg: color(T.yellow) });
    this.activityBar.add(this.activityText);
    root.add(this.activityBar);

    // Composer
    const composer = new BoxRenderable(this.renderer, {
      id: "composer",
      width: "100%",
      flexShrink: 0,
      border: true,
      borderStyle: "rounded",
      borderColor: color(T.accent),
      backgroundColor: color(T.panelAlt),
      paddingX: 1,
      flexDirection: "column",
      height: 6,
      gap: 0,
    });
    this.textarea = new TextareaRenderable(this.renderer, {
      id: "composer-input",
      width: "100%",
      height: 3,
      placeholder: "Ask Gidorah to inspect, edit, or run something…",
      placeholderColor: color(T.dim),
      textColor: color(T.text),
      backgroundColor: color(T.panelAlt),
      focusedBackgroundColor: color(T.panelAlt),
      focusedTextColor: color(T.text),
      wrapMode: "word",
      onSubmit: () => {
        const text = this.textarea.plainText.trim();
        if (text !== "") {
          this.textarea.clear();
          void this.submit(text);
        }
      },
    });
    composer.add(this.textarea);
    composer.add(new TextRenderable(this.renderer, {
      id: "composer-hint",
      fg: color(T.dim),
      content: "Enter send · Shift+Enter newline · Tab complete · Ctrl+O expand tools · Ctrl+C cancel",
    }));
    root.add(composer);

    // Footer
    root.add(new TextRenderable(this.renderer, {
      id: "footer",
      flexShrink: 0,
      fg: color(T.dim),
      content: `${this.opts.branch} · ${this.opts.cwd.split(/[\\\\/]/).at(-1) ?? this.opts.cwd} · session ${this.session.header.sessionId} · theme ${this.themeName} · /help`,
    }));

    // Approval overlay
    this.approvalLayer = new BoxRenderable(this.renderer, {
      id: "approval-layer",
      position: "absolute",
      width: "100%",
      height: "100%",
      zIndex: 100,
      backgroundColor: RGBA.fromValues(0, 0, 0, 0.62),
      justifyContent: "center",
      alignItems: "center",
      visible: false,
    });
    const modal = new BoxRenderable(this.renderer, {
      id: "approval-modal",
      width: "72%",
      minWidth: 52,
      maxHeight: "70%",
      zIndex: 101,
      border: true,
      borderStyle: "double",
      borderColor: color(T.yellow),
      backgroundColor: color("#161b26"),
      flexDirection: "column",
      padding: 1,
      gap: 1,
    });
    this.approvalTitle = new TextRenderable(this.renderer, { id: "approval-title", content: "", fg: color(T.yellow) });
    modal.add(this.approvalTitle);
    this.approvalBody = new BoxRenderable(this.renderer, { id: "approval-body", width: "100%", flexDirection: "column", gap: 0 });
    modal.add(this.approvalBody);
    const buttons = new BoxRenderable(this.renderer, { id: "approval-buttons", flexDirection: "row", justifyContent: "flex-end", gap: 2 });
    this.approvalAllow = this.button("▶ Allow (y)", T.green, () => this.respond("allow"));
    this.approvalDeny = this.button("✕ Deny (n)", T.red, () => this.respond("deny"));
    buttons.add(this.approvalAllow);
    buttons.add(this.approvalDeny);
    modal.add(buttons);
    modal.add(new TextRenderable(this.renderer, { id: "approval-hint", fg: color(T.dim), content: "y allow · n/Esc deny · click a button" }));
    this.approvalLayer.add(modal);
    this.renderer.root.add(this.approvalLayer);

    // Session picker overlay
    this.pickerLayer = new BoxRenderable(this.renderer, {
      id: "picker-layer",
      position: "absolute",
      width: "100%",
      height: "100%",
      zIndex: 90,
      backgroundColor: RGBA.fromValues(0, 0, 0, 0.62),
      justifyContent: "center",
      alignItems: "center",
      visible: false,
    });
    const pickerModal = new BoxRenderable(this.renderer, {
      id: "picker-modal",
      width: "70%",
      minWidth: 46,
      border: true,
      borderStyle: "double",
      borderColor: color(T.cyan),
      backgroundColor: color("#161b26"),
      flexDirection: "column",
      padding: 1,
      gap: 1,
    });
    pickerModal.add(new TextRenderable(this.renderer, { id: "picker-title", content: "Resume session", fg: color(T.cyan) }));
    this.picker = new SelectRenderable(this.renderer, {
      id: "picker-list",
      width: "100%",
      height: 10,
      options: [],
      backgroundColor: color(T.panel),
      textColor: color(T.text),
      focusedBackgroundColor: color(T.panelAlt),
      focusedTextColor: color(T.text),
      selectedBackgroundColor: color(T.accent),
      selectedTextColor: color(T.bg),
    });
    this.picker.on("itemSelected", (index: number) => {
      const entry = this.pickerItems[index];
      this.hidePicker();
      if (entry !== undefined) this.resumeSession(entry.id);
    });
    pickerModal.add(this.picker);
    pickerModal.add(new TextRenderable(this.renderer, { id: "picker-hint", fg: color(T.dim), content: "↑/↓ select · Enter resume · Esc cancel" }));
    this.pickerLayer.add(pickerModal);
    this.renderer.root.add(this.pickerLayer);

    // Theme picker overlay
    this.themeLayer = new BoxRenderable(this.renderer, {
      id: "theme-layer",
      position: "absolute",
      width: "100%",
      height: "100%",
      zIndex: 95,
      backgroundColor: RGBA.fromValues(0, 0, 0, 0.62),
      justifyContent: "center",
      alignItems: "center",
      visible: false,
    });
    const themeModal = new BoxRenderable(this.renderer, {
      id: "theme-modal",
      width: "50%",
      minWidth: 34,
      border: true,
      borderStyle: "double",
      borderColor: color(T.cyan),
      backgroundColor: color("#161b26"),
      flexDirection: "column",
      padding: 1,
      gap: 1,
    });
    themeModal.add(new TextRenderable(this.renderer, { id: "theme-title", content: `Theme · current ${this.themeName}`, fg: color(T.cyan) }));
    this.themePicker = new SelectRenderable(this.renderer, {
      id: "theme-list",
      width: "100%",
      height: 10,
      options: this.themeNames.map((name) => ({ name, description: "", value: name })),
      backgroundColor: color(T.panel),
      textColor: color(T.text),
      focusedBackgroundColor: color(T.panelAlt),
      focusedTextColor: color(T.text),
      selectedBackgroundColor: color(T.accent),
      selectedTextColor: color(T.bg),
    });
    this.themePicker.on("itemSelected", (index: number) => {
      const name = this.themeNames[index];
      this.hideThemePicker();
      if (name !== undefined) this.applyTheme(name);
    });
    themeModal.add(this.themePicker);
    themeModal.add(new TextRenderable(this.renderer, { id: "theme-hint", fg: color(T.dim), content: "↑/↓ select · Enter apply · Esc cancel" }));
    this.themeLayer.add(themeModal);
    this.renderer.root.add(this.themeLayer);

    this.renderer.focusRenderable(this.textarea);
    this.sync();
  }

  private themeFile(): string | undefined {
    return this.opts.historyFile?.replace(/tui-history$/, "tui-theme");
  }

  private loadTheme(): string {
    try {
      const file = this.themeFile();
      if (file !== undefined && existsSync(file)) {
        const name = readFileSync(file, "utf8").trim();
        if (THEMES[name] !== undefined) return name;
      }
    } catch {
      // fall through
    }
    return "tokyo-night";
  }

  private persistTheme(): void {
    const file = this.themeFile();
    if (file === undefined) return;
    try {
      writeFileSync(file, this.themeName, "utf8");
    } catch {
      // best effort
    }
  }

  applyTheme(name: string): void {
    if (THEMES[name] === undefined) {
      this.info(`unknown theme ${name} · available: ${this.themeNames.join(", ")}`);
      return;
    }
    this.themeName = name;
    T = THEMES[name]!;
    this.persistTheme();
    for (const child of [...this.renderer.root.getChildren()]) {
      try {
        child.destroyRecursively();
      } catch {
        // ignore native cleanup failures
      }
      this.renderer.root.remove(child);
    }
    this.statusValues = [];
    this.mount();
    this.renderer.focusRenderable(this.textarea);
    this.sync();
  }

  private showThemePicker(): void {
    this.themeLayer.visible = true;
    this.renderer.focusRenderable(this.themePicker);
    this.renderer.requestRender();
  }

  private hideThemePicker(): void {
    this.themeLayer.visible = false;
    this.renderer.focusRenderable(this.textarea);
    this.renderer.requestRender();
  }

  private pill(label: string, value: string, fg: string): { box: BoxRenderable; valueText: TextRenderable } {
    const box = new BoxRenderable(this.renderer, {
      id: `pill-${label}`,
      flexDirection: "row",
      border: false,
      backgroundColor: color(T.panel),
      paddingX: 1,
      gap: 0,
    });
    box.add(new TextRenderable(this.renderer, { id: `pill-${label}-label`, content: `${label}:`, fg: color(T.dim) }));
    const valueText = new TextRenderable(this.renderer, { id: `pill-${label}-value`, content: ` ${value}`, fg: color(fg) });
    box.add(valueText);
    return { box, valueText };
  }

  private button(label: string, fg: string, onClick: () => void): BoxRenderable {
    const box = new BoxRenderable(this.renderer, {
      id: `button-${label}`,
      border: true,
      borderStyle: "rounded",
      borderColor: color(fg),
      backgroundColor: color(T.panelAlt),
      paddingX: 1,
      onMouseDown: () => onClick(),
      onMouseOver: () => {
        box.backgroundColor = color(fg);
      },
      onMouseOut: () => {
        box.backgroundColor = color(T.panelAlt);
      },
    });
    box.add(new TextRenderable(this.renderer, { id: `button-${label}-text`, content: label, fg: color(fg) }));
    return box;
  }

  private wireKeys(): void {
    this.renderer.keyInput.on("keypress", (key: KeyEvent) => {
      if (this.phase === "approval") {
        if (key.name === "y") {
          key.preventDefault();
          this.respond("allow");
          return;
        }
        if (key.name === "n" || key.name === "escape") {
          key.preventDefault();
          this.respond("deny");
          return;
        }
      }
      if (this.pickerLayer.visible) {
        if (key.name === "escape") {
          key.preventDefault();
          this.hidePicker();
        }
        return;
      }
      if (this.themeLayer.visible) {
        if (key.name === "escape") {
          key.preventDefault();
          this.hideThemePicker();
        }
        return;
      }
      if (key.ctrl === true && key.name === "c") {
        key.preventDefault();
        this.interrupt();
        return;
      }
      if (key.ctrl === true && key.name === "d") {
        key.preventDefault();
        this.stop(0);
        return;
      }
      if (key.ctrl === true && key.name === "o") {
        key.preventDefault();
        this.toggleTool(false);
        return;
      }
      if (key.ctrl === true && key.name === "e") {
        key.preventDefault();
        this.toggleTool(true);
        return;
      }
      if (key.name === "return" && key.shift !== true && this.phase !== "running") {
        key.preventDefault();
        const text = this.textarea.plainText.trim();
        if (text !== "") {
          this.textarea.clear();
          void this.submit(text);
        }
        return;
      }
      if (key.name === "tab") {
        key.preventDefault();
        this.complete();
      }
    });
  }

  private statusPills(): Array<[string, string, string]> {
    return [
      ["mode", this.opts.mode, this.opts.mode === "mock" ? T.yellow : T.green],
      ["model", this.modelAlias.split("/").at(-1) ?? this.modelAlias, T.cyan],
      ["budget", `$${this.llmUsd.toFixed(3)}/$${this.llmLimit.toFixed(2)}`, T.green],
      ["research", `${this.researchCredits}/${this.researchLimit}`, T.cyan],
      ["dlp", this.dlp, this.dlp === "clean" ? T.green : T.red],
      ["cache", `${Math.round(this.cacheHitRate * 100)}%`, T.dim],
      ["ctx", `${Math.round(this.contextPressure * 100)}%`, T.dim],
      ["compact", this.compaction, T.dim],
    ];
  }

  private sync(): void {
    this.badgeMode.content = `${this.opts.mode.toUpperCase()} MODE`;
    this.badgeMode.fg = color(this.opts.mode === "mock" ? T.yellow : T.green);
    this.badgeModel.content = this.modelAlias.split("/").at(-1) ?? this.modelAlias;
    this.banner.visible = this.opts.mode === "mock";
    const values = [this.opts.mode, this.modelAlias.split("/").at(-1) ?? this.modelAlias, `$${this.llmUsd.toFixed(3)}/$${this.llmLimit.toFixed(2)}`, `${this.researchCredits}/${this.researchLimit}`, this.dlp, `${Math.round(this.cacheHitRate * 100)}%`, `${Math.round(this.contextPressure * 100)}%`, this.compaction];
    this.statusValues.forEach((text, index) => {
      const value = values[index];
      if (value !== undefined) text.content = ` ${value}`;
    });
    this.activityBar.visible = this.phase === "running";
    if (this.phase === "running") {
      const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
      const elapsed = this.activityStarted === 0 ? "" : ` ${Math.round((Date.now() - this.activityStarted) / 1000)}s`;
      this.activityText.content = `${frames[this.spinner % frames.length]} ${this.activity}${elapsed}`;
    }
    this.textarea.visible = this.phase !== "running";
    this.renderTranscript();
    this.renderer.requestRender();
  }

  private scheduleSync(): void {
    if (this.renderTimer !== null) return;
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      this.sync();
    }, 20);
  }

  private clearTranscript(): void {
    for (const child of [...this.transcript.getChildren()]) this.transcript.remove(child);
  }

  private renderTranscript(): void {
    this.clearTranscript();
    if (this.items.length === 0) {
      this.transcript.add(this.welcome());
      return;
    }
    for (const item of this.items) {
      const card = this.card(item);
      if (card !== null) this.transcript.add(card);
    }
  }

  private welcome(): BoxRenderable {
    const box = new BoxRenderable(this.renderer, {
      id: "welcome",
      width: "100%",
      border: false,
      backgroundColor: color(T.panelAlt),
      flexDirection: "column",
      paddingX: 2,
      paddingY: 1,
      gap: 1,
    });
    box.add(new TextRenderable(this.renderer, { id: "welcome-title", content: "Welcome to Gidorah", fg: color(T.text) }));
    box.add(new TextRenderable(this.renderer, { id: "welcome-mode", content: `mode ${this.opts.mode} · model ${this.modelAlias}`, fg: color(T.dim) }));
    box.add(new TextRenderable(this.renderer, { id: "welcome-help", content: "Ask for a code change, a review, or a shell task. `/help` lists commands.", fg: color(T.text) }));
    const chips = new BoxRenderable(this.renderer, { id: "welcome-chips", flexDirection: "row", flexWrap: "wrap", gap: 1 });
    for (const command of ["/status", "/resume", "/trace", "/receipt", "/help"]) {
      chips.add(this.chip(command, () => void this.submit(command)));
    }
    box.add(chips);
    box.add(new TextRenderable(this.renderer, {
      id: "welcome-cloud",
      fg: color(T.dim),
      content: this.opts.mode === "mock" ? "Cloud: set GIDORAH_MODE=cloud and BIFROST_BASE_URL, restart, then `/doctor`." : "Ready for real coding. `/doctor` checks the model plane.",
    }));
    return box;
  }

  private chip(label: string, onClick: () => void): BoxRenderable {
    const box = new BoxRenderable(this.renderer, {
      id: `chip-${label}`,
      border: true,
      borderStyle: "rounded",
      borderColor: color(T.border),
      backgroundColor: color(T.panel),
      paddingX: 1,
      onMouseDown: onClick,
      onMouseOver: () => {
        box.borderColor = color(T.accent);
      },
      onMouseOut: () => {
        box.borderColor = color(T.border);
      },
    });
    box.add(new TextRenderable(this.renderer, { id: `chip-${label}-text`, content: label, fg: color(T.cyan) }));
    return box;
  }

  private card(item: Item): BoxRenderable | null {
    const base = {
      width: "100%" as const,
      marginBottom: 1,
      flexDirection: "column" as const,
      paddingX: 1,
    };
    switch (item.kind) {
      case "user":
        return this.borderedItem("user", T.accent, `you`, item.text, [T.accent]);
      case "assistant": {
        const box = new BoxRenderable(this.renderer, { ...base, id: "assistant", border: ["left"], borderColor: color(T.purple), paddingLeft: 2 });
        const md = new MarkdownRenderable(this.renderer, {
          id: "assistant-md",
          width: "100%",
          content: item.text,
          fg: color(T.text),
          syntaxStyle: SyntaxStyle.create(this.renderer.nativeScene),
        });
        item.assistantCard = md;
        box.add(md);
        return box;
      }
      case "tool": {
        const tool = item.tool!;
        const statusColor = tool.status === "ok" ? T.green : tool.status === "running" ? T.yellow : T.red;
        const box = new BoxRenderable(this.renderer, {
          ...base,
          id: `tool-${tool.callId}`,
          border: true,
          borderStyle: "rounded",
          borderColor: color(statusColor),
          backgroundColor: color(T.panelAlt),
          paddingX: 1,
          title: ` ⚙ ${tool.name} · ${tool.status}${tool.elapsedMs === undefined ? "" : ` · ${Math.round(tool.elapsedMs)}ms`} `,
          titleColor: color(statusColor),
          onMouseDown: () => {
            tool.expanded = tool.expanded !== true;
            this.sync();
          },
          onMouseOver: () => {
            box.borderColor = color(T.accent);
          },
          onMouseOut: () => {
            box.borderColor = color(statusColor);
          },
        });
        item.toolBox = box;
        const summary = this.summaryArgs(tool.name, tool.args);
        if (summary !== "") box.add(new TextRenderable(this.renderer, { id: `tool-args-${tool.callId}`, content: summary, fg: color(T.dim), wrapMode: "word" }));
        if (tool.result !== undefined && tool.result !== "") {
          const lines = tool.result.split("\n");
          const shown = tool.expanded === true ? lines.slice(0, 40) : lines.slice(0, 3);
          box.add(new TextRenderable(this.renderer, { id: `tool-result-${tool.callId}`, content: shown.join("\n") + (lines.length > shown.length ? `\n… ${lines.length - shown.length} more lines (click or Ctrl+O)` : ""), fg: color(T.text), wrapMode: "word" }));
        }
        return box;
      }
      case "research":
        return this.borderedItem("research", T.cyan, "≈ research card", `${item.text}${item.sources === undefined ? "" : `\n${item.sources.map((source) => `↗ ${source}`).join("\n")}`}`, [T.cyan]);
      case "dlp":
        return this.borderedItem("dlp", T.red, "⛨ dlp", item.text, [T.red]);
      case "docs":
        return this.borderedItem("docs", T.magenta, "✎ docs guard", item.text, [T.magenta]);
      case "takeover":
        return this.borderedItem("takeover", T.yellow, "⇄ takeover", item.text, [T.yellow]);
      case "receipt":
        return this.borderedItem("receipt", T.green, "✓ receipt", item.text, [T.green]);
      case "error":
        return this.borderedItem("error", T.red, "✖ error", item.text, [T.red]);
      case "notice":
        return this.borderedItem("notice", T.yellow, "!", item.text, [T.yellow]);
      case "info":
        return this.borderedItem("info", T.border, "·", item.text, [T.dim]);
      default:
        return null;
    }
  }

  private borderedItem(_kind: string, borderColor: string, title: string, text: string, accentColors: string[]): BoxRenderable {
    const box = new BoxRenderable(this.renderer, {
      width: "100%" as const,
      marginBottom: 1,
      border: ["left"],
      borderColor: color(borderColor),
      backgroundColor: color(T.panelAlt),
      flexDirection: "column",
      paddingX: 1,
      paddingLeft: 2,
    });
    box.add(new TextRenderable(this.renderer, { id: `title-${title}`, content: title, fg: color(accentColors[0] ?? borderColor) }));
    box.add(new TextRenderable(this.renderer, { id: `text-${title}`, content: text, fg: color(T.text), wrapMode: "word" }));
    return box;
  }

  private summaryArgs(name: string, args: Record<string, unknown>): string {
    if (name === "edit" && typeof args.path === "string") return `edit ${args.path}`;
    if (name === "write" && typeof args.path === "string") return `write ${args.path}`;
    if (name === "bash" && typeof args.command === "string") return `$ ${args.command}`;
    if (name === "read" && typeof args.path === "string") return `read ${args.path}`;
    const keys = Object.keys(args).slice(0, 3).join(", ");
    return keys === "" ? "" : keys;
  }

  private async submit(raw: string): Promise<void> {
    const task = raw.trim();
    if (task === "") return;
    if (task.startsWith("/")) {
      this.command(task);
      return;
    }
    if (this.phase === "running") return;
    this.phase = "running";
    this.activity = "thinking…";
    this.activityStarted = Date.now();
    this.spinner = 0;
    this.abort = new AbortController();
    this.streaming = null;
    this.addHistory(task);
    this.textarea.clear();
    if (this.activityTimer !== null) clearInterval(this.activityTimer);
    this.activityTimer = setInterval(() => {
      this.spinner += 1;
      this.sync();
    }, 250);
    this.sync();
    try {
      const hooks: TuiHooks = {
        approval: this.approvalService,
        modelAlias: this.modelAlias,
        onModelDelta: (delta) => this.onDelta(delta),
        signal: this.abort.signal,
        ...(this.opts.maxSteps === undefined ? {} : { maxSteps: this.opts.maxSteps }),
      };
      const result = await runTask(this.session, task, this.opts.createDeps(this.session, hooks));
      this.trace = result.trace;
      this.receipts.push(result.receipt);
      this.items.push({ kind: "receipt", text: `${result.receipt.status} · ${result.receipt.tokens.total} tokens · $${result.receipt.llmCostUsd.toFixed(4)} · ${result.receipt.fallbacks} fallback(s) · ${result.receipt.summary}` });
      this.syncBudget();
    } catch (error) {
      this.items.push({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      if (this.activityTimer !== null) clearInterval(this.activityTimer);
      this.activityTimer = null;
      this.phase = "idle";
      this.approvalService.denyAll();
      this.hideApproval();
      this.abort = null;
      this.streaming = null;
      this.renderer.focusRenderable(this.textarea);
      this.sync();
    }
  }

  private onDelta(text: string): void {
    const clean = sanitize(text);
    if (clean === "") return;
    if (this.streaming === null) {
      const item: Item = { kind: "assistant", text: "" };
      this.streaming = item;
      this.items.push(item);
      this.sync();
    }
    this.streaming.text += clean;
    if (this.streaming.assistantCard !== undefined) {
      this.streaming.assistantCard.content = this.streaming.text;
      this.renderer.requestRender();
    } else {
      this.scheduleSync();
    }
  }

  private onEvent(event: SessionEvent): void {
    const data = event.data as Record<string, unknown>;
    this.metrics(event);
    switch (event.type) {
      case "user/message":
        this.items.push({ kind: "user", text: sanitize(String(data.content ?? "")) });
        break;
      case "assistant/message": {
        const content = sanitize(String(data.content ?? ""));
        if (this.streaming !== null) {
          this.streaming.text = content;
          if (this.streaming.assistantCard !== undefined) this.streaming.assistantCard.content = content;
          this.streaming = null;
        } else if (content.trim() !== "") {
          this.items.push({ kind: "assistant", text: content });
        }
        break;
      }
      case "tool/call": {
        const callId = String(data.callId ?? "");
        const name = String(data.name ?? "");
        const args = data.arguments !== null && typeof data.arguments === "object" ? (data.arguments as Record<string, unknown>) : {};
        this.activity = "running tool…";
        this.toolTimes.set(callId, event.time);
        this.toolArgs.set(callId, { name, args });
        this.items.push({ kind: "tool", text: "", tool: { callId, name, args, status: "running" } });
        break;
      }
      case "tool/result": {
        const callId = String(data.callId ?? "");
        const item = [...this.items].reverse().find((entry) => entry.kind === "tool" && entry.tool?.callId === callId);
        if (item?.tool !== undefined) {
          const error = data.error as { code?: string } | undefined;
          item.tool.status = data.ok === true ? "ok" : error?.code === "POLICY_DENIED" ? "denied" : "error";
          item.tool.result = sanitize(firstText(data)).slice(0, 4000);
          const started = this.toolTimes.get(callId);
          if (started !== undefined) item.tool.elapsedMs = event.time - started;
          if (item.tool.name === "research" && data.ok === true) {
            const meta = data.meta as { sources?: unknown; credits?: unknown } | undefined;
            this.researchCredits += Number(meta?.credits ?? 0);
            const sources = Array.isArray(meta?.sources) ? (meta.sources as unknown[]).map(String) : [];
            this.items.push({ kind: "research", text: item.tool.result.slice(0, 200).replace(/\n+/g, " "), ...(sources.length === 0 ? {} : { sources }) });
          }
        }
        this.activity = "verifying…";
        break;
      }
      case "approval/request": {
        const id = String(data.approvalId ?? "");
        const callId = String(data.callId ?? "");
        const tool = String(data.tool ?? "");
        const args = this.toolArgs.get(callId)?.args ?? {};
        this.phase = "approval";
        if (this.shownApprovalId !== id) {
          this.shownApprovalId = id;
          this.showApproval(tool, String(data.risk ?? ""), args, this.approvalService.pendingCount());
        }
        break;
      }
      case "approval/decision":
        this.phase = "running";
        this.shownApprovalId = null;
        this.hideApproval();
        break;
      case "route/changed":
        this.items.push({ kind: "takeover", text: `${formatRef(data.from)} → ${formatRef(data.to)} (${String(data.reason ?? "")})` });
        break;
      case "budget/updated":
        this.llmUsd = Number(data.used ?? this.llmUsd);
        this.llmLimit = Number(data.limit ?? this.llmLimit);
        break;
      case "dlp/blocked":
        this.dlp = "blocked";
        this.items.push({ kind: "dlp", text: `${String(data.class ?? "secret")} ${String(data.action ?? "blocked")}` });
        break;
      case "docs/check":
        this.items.push({ kind: "docs", text: `${String(data.result ?? "unknown")}` });
        break;
      case "session/error":
        this.items.push({ kind: "error", text: sanitize(String(data.message ?? "session error")) });
        break;
      default:
        break;
    }
    this.scheduleSync();
  }

  private metrics(event: SessionEvent): void {
    const data = event.data as Record<string, unknown>;
    if (event.type === "assistant/message") {
      const usage = data.usage as { input?: number; cacheRead?: number } | undefined;
      if (usage !== undefined) {
        const input = Number(usage.input ?? 0);
        const cached = Number(usage.cacheRead ?? 0);
        this.inputTokens += input;
        this.cacheRead += cached;
        this.cacheHitRate = this.cacheRead / Math.max(1, this.inputTokens + this.cacheRead);
        this.contextPressure = Math.min(1, input / Math.max(1, this.contextCap));
      }
    }
    if (event.type === "context/metrics") {
      if (typeof data.capTokens === "number") this.contextCap = Math.max(1, data.capTokens);
      const cleared = Number(data.cleared ?? 0);
      this.compaction = cleared > 0 ? "cleared" : data.compactionNetCostUsd !== undefined ? "compacted" : this.compaction;
    }
  }

  private syncBudget(): void {
    const snapshot = this.opts.budgetSnapshot();
    this.llmUsd = snapshot.usedUsd;
    this.llmLimit = snapshot.limitUsd;
  }

  private attach(session: Session): void {
    this.unsubscribe?.();
    this.session = session;
    this.unsubscribe = session.subscribe((event) => this.onEvent(event));
  }

  private showApproval(tool: string, risk: string, args: Record<string, unknown>, queueCount: number): void {
    this.approvalTitle.content = `Approval required · ${tool} · ${risk} · ${Math.max(1, queueCount)} pending`;
    for (const child of [...this.approvalBody.getChildren()]) this.approvalBody.remove(child);
    if (tool === "edit" && typeof args.path === "string" && typeof args.find === "string" && typeof args.replace === "string") {
      this.approvalBody.add(new TextRenderable(this.renderer, { id: "approval-path", content: args.path, fg: color(T.cyan) }));
      this.approvalBody.add(new DiffRenderable(this.renderer, {
        id: "approval-diff",
        width: "100%",
        height: Math.min(14, args.find.split("\n").length + args.replace.split("\n").length + 3),
        diff: unifiedDiff(args.path, args.find, args.replace),
        view: "unified",
        showLineNumbers: true,
        wrapMode: "word",
      }));
    } else if (tool === "bash" && typeof args.command === "string") {
      this.approvalBody.add(new BoxRenderable(this.renderer, { id: "approval-shell", border: true, borderStyle: "rounded", borderColor: color(T.border), paddingX: 1, width: "100%" }));
      const shell = this.approvalBody.getChildren()[0] as BoxRenderable;
      shell.add(new TextRenderable(this.renderer, { id: "approval-cmd", content: `$ ${args.command}`, fg: color(T.text) }));
    } else {
      this.approvalBody.add(new TextRenderable(this.renderer, { id: "approval-preview", content: JSON.stringify(args).slice(0, 400), fg: color(T.dim), wrapMode: "word" }));
    }
    this.approvalLayer.visible = true;
    this.sync();
  }

  private hideApproval(): void {
    this.approvalLayer.visible = false;
    this.renderer.focusRenderable(this.textarea);
    this.renderer.requestRender();
  }

  private respond(decision: "allow" | "deny"): void {
    this.approvalService.respond(decision);
    this.phase = "running";
    this.shownApprovalId = null;
    this.hideApproval();
    this.sync();
  }

  private showPicker(entries: TuiSessionEntry[]): void {
    this.pickerItems = entries;
    this.picker.options = entries.map((entry) => ({ name: entry.id, description: entry.label, value: entry.id }));
    this.pickerLayer.visible = true;
    this.renderer.focusRenderable(this.picker);
    this.renderer.requestRender();
  }

  private hidePicker(): void {
    this.pickerLayer.visible = false;
    this.renderer.focusRenderable(this.textarea);
    this.renderer.requestRender();
  }

  private resumeSession(id: string): void {
    try {
      const loaded = this.opts.loadSession(id);
      this.attach(loaded);
      this.items = replaySessionTranscript(loaded).map((entry) => ({ ...entry, text: "text" in entry ? entry.text : "" }) as Item);
      this.receipts = [];
      this.trace = [];
      this.hidePicker();
      this.info(`resumed ${loaded.header.sessionId} · ${loaded.all.length} events replayed`);
      this.sync();
    } catch (error) {
      this.info(`resume failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private command(line: string): void {
    const [name, ...rest] = line.trim().split(/\s+/);
    const arg = rest.join(" ");
    switch (name) {
      case "/help":
        this.info("/help /status /model /theme /budget /trace /receipt /new /resume /doctor /quit\nEnter send · Shift+Enter newline · Tab complete · y/n approve");
        return;
      case "/doctor":
        this.info(this.opts.mode === "mock" ? "mock mode: no provider calls. Set GIDORAH_MODE=cloud and BIFROST_BASE_URL, start Bifrost, restart." : `cloud mode · model ${this.modelAlias} · if requests fail, check BIFROST_BASE_URL and the gateway on :8080`);
        return;
      case "/status":
        this.info(`session ${this.session.header.sessionId} · ${this.opts.mode} · ${this.modelAlias} · $${this.llmUsd.toFixed(4)}/$${this.llmLimit.toFixed(2)} · receipts ${this.receipts.length}`);
        return;
      case "/theme": {
        if (arg !== "") this.applyTheme(arg);
        else this.showThemePicker();
        return;
      }
      case "/model":
        if (arg !== "") {
          this.modelAlias = this.modelOptions.find((alias) => alias === arg) ?? arg;
          this.info(`model alias set to ${this.modelAlias} (next turn)`);
          return;
        }
        this.info(`model ${this.modelAlias} · available ${this.modelOptions.join(", ")}`);
        return;
      case "/budget": {
        const snapshot = this.opts.budgetSnapshot();
        this.info(`llm $${snapshot.usedUsd.toFixed(4)}/$${snapshot.limitUsd.toFixed(2)} remaining $${snapshot.remainingUsd.toFixed(4)}`);
        return;
      }
      case "/trace":
        this.info(this.trace.length === 0 ? "no trace yet; run a task first" : this.trace.map((record) => `${record.phase}: ${record.served.provider}/${record.served.model} · ${record.tokens.total} tokens · $${record.costUsd.toFixed(6)} · fallback ${record.fallback ? "yes" : "no"}`).join("\n"));
        return;
      case "/receipt": {
        const receipt = this.receipts.at(-1);
        this.info(receipt === undefined ? "no receipt yet; run a task first" : `${receipt.status} · ${receipt.tokens.total} tokens · $${receipt.llmCostUsd.toFixed(4)} · ${receipt.summary}`);
        return;
      }
      case "/new":
        this.session.append("session/end", { reason: "replaced by /new" });
        this.attach(this.opts.createSession());
        this.items = [];
        this.receipts = [];
        this.trace = [];
        this.opts.resetBudget?.();
        this.llmUsd = 0;
        this.info(`new session ${this.session.header.sessionId}`);
        return;
      case "/resume": {
        if (arg !== "") {
          this.resumeSession(arg);
          return;
        }
        const entries = this.opts.listSessions?.() ?? [];
        if (entries.length === 0) this.info("no sessions recorded yet");
        else this.showPicker(entries);
        return;
      }
      case "/quit":
      case "/exit":
        this.stop(0);
        return;
      default:
        this.info(`unknown command: ${name ?? ""} (try /help)`);
    }
  }

  private info(text: string): void {
    this.items.push({ kind: "info", text: sanitize(text) });
    this.sync();
  }

  private interrupt(): void {
    if (this.phase === "running") {
      if (this.abort !== null && !this.abort.signal.aborted) {
        this.abort.abort();
        this.info("cancelling turn…");
      } else {
        this.stop(130);
      }
      return;
    }
    if (this.exitArmed) {
      this.stop(130);
      return;
    }
    this.exitArmed = true;
    this.info("press Ctrl+C again to exit");
  }

  private toggleTool(all: boolean): void {
    const tools = this.items.filter((item) => item.kind === "tool" && item.tool !== undefined);
    if (tools.length === 0) return;
    if (all) {
      const anyCollapsed = tools.some((item) => item.tool!.expanded !== true);
      for (const item of tools) item.tool!.expanded = anyCollapsed;
    } else {
      const last = tools.at(-1)!;
      last.tool!.expanded = last.tool!.expanded !== true;
    }
    this.sync();
  }

  private complete(): void {
    const value = this.textarea.plainText;
    const commands = ["/help", "/status", "/model", "/budget", "/trace", "/receipt", "/new", "/resume", "/doctor", "/quit"];
    if (value.startsWith("/")) {
      const matches = commands.filter((command) => command.startsWith(value));
      if (matches.length === 1) {
        this.textarea.setText(matches[0]!);
        return;
      }
    }
    const token = /\S*$/.exec(value)?.[0] ?? "";
    if (token === "") return;
    const slash = token.lastIndexOf("/");
    const dir = slash >= 0 ? token.slice(0, slash) : ".";
    const base = slash >= 0 ? token.slice(slash + 1) : token;
    try {
      const entries = readdirSync(resolve(this.opts.cwd, dir)).filter((entry) => entry.startsWith(base));
      if (entries.length === 1) this.textarea.setText(`${value.slice(0, value.length - token.length)}${slash >= 0 ? token.slice(0, slash + 1) : ""}${entries[0]}`);
    } catch {
      // no completions
    }
  }

  private addHistory(text: string): void {
    if (this.history.at(-1) !== text) this.history.push(text);
    if (this.history.length > 200) this.history = this.history.slice(-200);
    this.persistHistory();
  }

  private loadHistory(): string[] {
    if (this.opts.historyFile === undefined || !existsSync(this.opts.historyFile)) return [];
    try {
      return readFileSync(this.opts.historyFile, "utf8").split("\n").filter((line) => line.trim() !== "").slice(-200);
    } catch {
      return [];
    }
  }

  private persistHistory(): void {
    if (this.opts.historyFile === undefined) return;
    try {
      writeFileSync(this.opts.historyFile, this.history.join("\n"), "utf8");
    } catch {
      // best effort
    }
  }


  stop(code = 0): void {
    if (this.phase === "exited") return;
    this.phase = "exited";
    this.approvalService.denyAll();
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.activityTimer !== null) clearInterval(this.activityTimer);
    if (this.renderTimer !== null) clearTimeout(this.renderTimer);
    this.persistHistory();
    try {
      this.renderer.destroy();
    } catch {
      // renderer already gone
    }
    this.done?.(code);
    this.done = null;
  }
}
