/**
 * Interactive Gidorah TUI.
 *
 * One Session across turns. The runtime appends to the session; the app
 * subscribes to the stream and projects it to transcript items while the model
 * streams deltas through RuntimeDeps.onModelDelta. Input is raw-mode keypress;
 * plain/non-TTY operation is handled by plain.ts.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import readline from "node:readline";
import { runTask, type ApprovalService, type BudgetSnapshot, type RuntimeDeps } from "../../../packages/core/src/runtime.ts";
import { Session } from "../../../packages/core/src/session.ts";
import type { Receipt, SessionEvent, TraceRecord } from "../../../packages/shared/src/types.ts";
import { TuiAdapter } from "./adapter.ts";
import { InteractiveApprovalService } from "./approval.ts";
import { classifyKey, type KeyInfo } from "./keys.ts";
import { renderScreen, type ApprovalView, type ToolView, type TranscriptItem, type TuiView } from "./layout.ts";
import { sanitizeUntrusted, type StatusState } from "./index.ts";

export interface TuiHooks {
  approval: ApprovalService;
  modelAlias?: string;
  onModelDelta?: (text: string) => void;
  signal?: AbortSignal;
  maxSteps?: number;
}

export interface TuiSessionEntry {
  id: string;
  label: string;
}

export interface TuiAppOptions {
  session: Session;
  createDeps: (session: Session, hooks: TuiHooks) => RuntimeDeps;
  createSession: () => Session;
  listSessions: () => TuiSessionEntry[];
  loadSession: (id: string) => Session;
  budgetSnapshot: () => BudgetSnapshot;
  resetBudget?: () => void;
  cwd: string;
  branch: string;
  mode: string;
  modelAlias: string;
  availableAliases?: string[];
  researchLimit?: number;
  maxSteps?: number;
  color?: boolean;
  width?: number;
  height?: number;
  historyFile?: string;
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
}

interface State {
  transcript: TranscriptItem[];
  input: string;
  cursor: number;
  phase: "idle" | "running" | "approval" | "exited";
  approval: ApprovalView | null;
  resumeOptions: TuiSessionEntry[] | null;
  resumeIndex: number;
  modelAlias: string;
  modelOptions: string[];
  receipts: Receipt[];
  lastTrace: TraceRecord[];
  status: StatusState;
  history: string[];
  historyIndex: number;
  exitArmed: boolean;
}

function sanitize(text: string): string {
  return sanitizeUntrusted(text);
}

function formatRef(value: unknown): string {
  if (typeof value === "string") return value;
  if (value !== null && typeof value === "object") {
    const ref = value as { provider?: string; model?: string };
    if (ref.provider !== undefined && ref.model !== undefined) return `${ref.provider}/${ref.model}`;
  }
  return "unknown";
}

function firstText(data: Record<string, unknown>): string {
  const content = data.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block !== null && typeof block === "object" && typeof (block as { text?: unknown }).text === "string") {
        return (block as { text: string }).text;
      }
    }
  }
  return "";
}

function diffFor(tool: string, args: Record<string, unknown>): Partial<ApprovalView> {
  if (tool === "edit" && typeof args.find === "string" && typeof args.replace === "string") {
    return {
      diff: [
        { kind: "path", text: String(args.path ?? "") },
        ...args.find.split("\n").map((line) => ({ kind: "remove" as const, text: line })),
        ...args.replace.split("\n").map((line) => ({ kind: "add" as const, text: line })),
      ],
    };
  }
  if (tool === "bash" && typeof args.command === "string") {
    const readOnly = /(^|\\s)(ls|cat|pwd|rg|grep|git\\s+(status|log|diff)|node\\s+--test|npm\\s+test)(\\s|$)/.test(args.command);
    const risky = /(npm\\s+(install|ci)|pnpm|git\\s+(push|commit|reset)|curl|wget|ssh|scp)/.test(args.command);
    return { diff: [{ kind: "path", text: "shell" }, { kind: "context", text: args.command }], hint: readOnly ? "read-only command" : risky ? "network or mutating command" : "shell command" };
  }
  if (tool === "write" && typeof args.path === "string") {
    const body = typeof args.content === "string" ? args.content : "";
    return {
      diff: [{ kind: "path", text: args.path }, ...body.split("\n").slice(0, 10).map((line) => ({ kind: "add" as const, text: line }))],
      hint: "new or overwritten file",
    };
  }
  return {};
}

export class TuiApp {
  private readonly opts: TuiAppOptions;
  private readonly io: { stdin: NodeJS.ReadStream; stdout: NodeJS.WriteStream };
  private readonly interactive: boolean;
  private readonly approvalService = new InteractiveApprovalService();
  private state: State;
  private session: Session;
  private unsubscribe: (() => void) | null = null;
  private keyListener: ((str: string | undefined, key: KeyInfo | undefined) => void) | null = null;
  private resizeListener: (() => void) | null = null;
  private abort: AbortController | null = null;
  private streamingItem: Extract<TranscriptItem, { kind: "assistant" }> | null = null;
  private startTimes = new Map<string, number>();
  private callArgs = new Map<string, { name: string; args: Record<string, unknown> }>();
  private renderScheduled = false;
  private renderTimer: NodeJS.Timeout | null = null;
  private done: ((code: number) => void) | null = null;
  private signalHandlers: Array<{ signal: NodeJS.Signals; handler: () => void }> = [];
  private cacheReadTotal = 0;
  private inputTokenTotal = 0;
  private contextCapTokens = 128_000;

  constructor(options: TuiAppOptions) {
    this.opts = options;
    this.session = options.session;
    this.io = {
      stdin: options.stdin ?? process.stdin,
      stdout: options.stdout ?? (process.stdout as unknown as NodeJS.WriteStream),
    };
    this.interactive = (options.stdin ?? process.stdin).isTTY === true && (options.stdout ?? process.stdout).isTTY === true;
    const width = options.width ?? this.io.stdout.columns ?? 100;
    const height = options.height ?? this.io.stdout.rows ?? 30;
    this.state = {
      transcript: [],
      input: "",
      cursor: 0,
      phase: "idle",
      approval: null,
      resumeOptions: null,
      resumeIndex: 0,
      modelAlias: options.modelAlias,
      modelOptions: options.availableAliases ?? [options.modelAlias],
      receipts: [],
      lastTrace: [],
      status: {
        mode: options.mode,
        route: options.modelAlias,
        llmUsd: 0,
        llmLimit: options.budgetSnapshot().limitUsd,
        researchCredits: 0,
        researchLimit: options.researchLimit ?? 50,
        dlp: "clean",
        cacheHitRate: 0,
        contextPressure: 0,
        compaction: "off",
      },
      history: this.loadHistory(),
      historyIndex: 0,
      exitArmed: false,
    };
    this.state.historyIndex = this.state.history.length;
    this.approvalService.onChange = () => {
      this.state.approval = this.approvalView();
      this.render();
    };
    this.attach(this.session);
  }

  /** Test/demo entry point: returns the screen without touching the terminal. */
  snapshot(width = this.io.stdout.columns ?? 100, height = this.io.stdout.rows ?? 30): string {
    return renderScreen({ ...this.view(), width, height, color: false });
  }

  transcript(): readonly TranscriptItem[] {
    return this.state.transcript;
  }

  phase(): State["phase"] {
    return this.state.phase;
  }

  pendingApproval(): boolean {
    return this.approvalService.current() !== null;
  }

  respond(decision: "allow" | "deny"): boolean {
    const ok = this.approvalService.respond(decision);
    this.state.approval = null;
    this.state.phase = ok ? "running" : this.state.phase;
    this.render();
    return ok;
  }

  async start(): Promise<number> {
    if (!this.interactive) return 0;
    try {
      this.io.stdout.write("\u001b[?1049h\u001b[?25l");
      readline.emitKeypressEvents(this.io.stdin);
      this.io.stdin.setRawMode(true);
      this.io.stdin.resume();
      this.keyListener = (str, key) => this.handleKey(str, key);
      this.io.stdin.on("keypress", this.keyListener);
      this.resizeListener = () => {
        this.paint(true);
      };
      this.io.stdout.on("resize", this.resizeListener);
      this.installSignalHandlers();
      this.paint(true);
    } catch (error) {
      this.cleanupTerminal();
      throw error;
    }
    return new Promise((resolve) => {
      this.done = resolve;
    });
  }

  private installSignalHandlers(): void {
    const handle = (): void => this.stop(130);
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
      const handler = (): void => handle();
      try {
        process.on(signal, handler);
        this.signalHandlers.push({ signal, handler });
      } catch {
        // signal not available on this platform
      }
    }
  }

  private cleanupTerminal(): void {
    if (this.renderTimer !== null) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    if (this.keyListener !== null) this.io.stdin.off("keypress", this.keyListener);
    if (this.resizeListener !== null) this.io.stdout.off("resize", this.resizeListener);
    for (const { signal, handler } of this.signalHandlers) {
      try {
        process.off(signal, handler);
      } catch {
        // already removed
      }
    }
    this.signalHandlers = [];
    try {
      this.io.stdin.setRawMode(false);
    } catch {
      // not in raw mode
    }
    this.io.stdin.pause();
    this.io.stdout.write("\u001b[?25h\u001b[?1049l");
  }
  handleKey(str: string | undefined, key: KeyInfo | undefined): void {
    if (this.state.phase === "exited") return;
    const action = classifyKey(str, key);
    if (this.state.phase === "approval" && this.approvalService.current() !== null) {
      if (str === "y" || str === "Y") {
        this.respond("allow");
        return;
      }
      if (str === "n" || str === "N" || action.type === "escape") {
        this.respond("deny");
        return;
      }
      if (action.type === "ctrl-c") {
        this.approvalService.respond("deny");
        this.state.approval = null;
        this.abort?.abort();
        this.notice("denied; cancelling turn");
        return;
      }
      return;
    }
    if (this.state.resumeOptions !== null) {
      if (action.type === "up") {
        this.state.resumeIndex = Math.max(0, this.state.resumeIndex - 1);
        this.render();
        return;
      }
      if (action.type === "down") {
        this.state.resumeIndex = Math.min(this.state.resumeOptions.length - 1, this.state.resumeIndex + 1);
        this.render();
        return;
      }
      if (action.type === "escape") {
        this.state.resumeOptions = null;
        this.render();
        return;
      }
      if (action.type === "enter") {
        const chosen = this.state.resumeOptions[this.state.resumeIndex];
        if (chosen !== undefined) this.resumeSession(chosen.id);
        return;
      }
      if (action.type === "char" && /^[0-9]$/.test(action.text)) {
        const chosen = this.state.resumeOptions[Number(action.text) - 1];
        if (chosen !== undefined) this.resumeSession(chosen.id);
        return;
      }
      return;
    }
    switch (action.type) {
      case "ctrl-d":
        this.stop(0);
        return;
      case "ctrl-c":
        this.handleCtrlC();
        return;
      case "ctrl-l":
        this.paint(true);
        return;
      case "ctrl-o":
        this.toggleLastTool();
        return;
      case "ctrl-e":
        this.toggleAllTools();
        return;
      case "tab":
        this.complete();
        return;
      case "escape":
        this.state.input = "";
        this.state.cursor = 0;
        this.render();
        return;
      case "enter":
        void this.handleEnter(key);
        return;
      case "up":
        this.historyMove(-1);
        return;
      case "down":
        this.historyMove(1);
        return;
      case "left":
        this.moveLeft();
        this.render();
        return;
      case "right":
        this.moveRight();
        this.render();
        return;
      case "home":
        this.state.cursor = 0;
        this.render();
        return;
      case "end":
        this.state.cursor = this.state.input.length;
        this.render();
        return;
      case "backspace":
        this.backspace();
        this.render();
        return;
      case "delete":
        this.deleteForward();
        this.render();
        return;
      case "char":
        this.insert(action.text);
        return;
      default:
        return;
    }
  }
  async submit(raw: string): Promise<void> {
    const task = raw.trim();
    if (task === "") return;
    if (task.startsWith("/")) {
      this.command(task);
      return;
    }
    if (this.state.phase === "running") {
      this.notice("a turn is already running");
      return;
    }
    this.state.phase = "running";
    this.state.status.route = this.opts.modelAlias;
    this.state.exitArmed = false;
    this.abort = new AbortController();
    this.streamingItem = null;
    this.addHistory(task);
    this.state.input = "";
    this.state.cursor = 0;
    this.render();
    try {
      const hooks: TuiHooks = {
        approval: this.approvalService,
        modelAlias: this.state.modelAlias,
        onModelDelta: (delta) => this.onDelta(delta),
        signal: this.abort.signal,
        ...(this.opts.maxSteps === undefined ? {} : { maxSteps: this.opts.maxSteps }),
      };
      const deps = this.opts.createDeps(this.session, hooks);
      const result = await runTask(this.session, task, deps);
      this.state.lastTrace = result.trace;
      this.state.receipts.push(result.receipt);
      this.state.transcript.push({
        kind: "receipt",
        text: `${result.receipt.status} · ${result.receipt.tokens.total} tokens · $${result.receipt.llmCostUsd.toFixed(4)} · ${result.receipt.fallbacks} fallback(s) · ${result.receipt.summary}`,
      });
      this.syncBudget();
    } catch (error) {
      this.state.transcript.push({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      this.state.phase = "idle";
      this.state.approval = null;
      this.abort = null;
      this.streamingItem = null;
      this.render();
    }
  }

  stop(code = 0): void {
    if (this.state.phase === "exited") return;
    if (this.state.phase === "running") {
      try {
        this.session.closeOpenBoundaries();
      } catch {
        // session may already be closed
      }
    }
    this.state.phase = "exited";
    this.approvalService.denyAll();
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.interactive) this.cleanupTerminal();
    this.persistHistory();
    this.done?.(code);
    this.done = null;
  }
  renderToString(): string {
    return this.snapshot();
  }

  // -------------------------------------------------------------------------
  // internals
  // -------------------------------------------------------------------------

  private view(): TuiView {
    return {
      cwd: this.opts.cwd,
      branch: this.opts.branch,
      sessionId: this.session.header.sessionId,
      mode: this.opts.mode,
      modelAlias: this.state.modelAlias,
      ...(this.state.resumeOptions === null ? {} : { resumeSelected: this.state.resumeIndex }),
      status: this.state.status,
      transcript: this.state.transcript,
      input: this.state.input,
      cursor: this.state.cursor,
      approval: this.state.approval,
      phase: this.state.phase,
      width: this.io.stdout.columns ?? 100,
      height: this.io.stdout.rows ?? 30,
      color: this.opts.color === true,
      resumeOptions: this.state.resumeOptions,
    };
  }

  private render(): void {
    if (!this.interactive || this.state.phase === "exited") return;
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    this.renderTimer = setTimeout(() => {
      this.renderScheduled = false;
      this.renderTimer = null;
      this.paint(false);
    }, 16);
  }

  private paint(clear: boolean): void {
    if (!this.interactive || this.state.phase === "exited") return;
    const screen = this.view();
    const width = Math.max(40, this.io.stdout.columns ?? screen.width);
    const height = Math.max(12, this.io.stdout.rows ?? screen.height);
    try {
      this.io.stdout.write(`${clear ? "\u001b[2J\u001b[1;1H" : "\u001b[1;1H"}${renderScreen({ ...screen, width, height })}`);
    } catch {
      // a broken pipe must not take down the session
    }
  }

  private async handleEnter(key: KeyInfo | undefined): Promise<void> {
    if (key?.shift === true || this.state.input.endsWith("\\")) {
      const continued = key?.shift === true ? this.state.input : this.state.input.slice(0, -1);
      this.state.input = `${continued}\n`;
      this.state.cursor = this.state.input.length;
      this.render();
      return;
    }
    const text = this.state.input;
    this.state.input = "";
    this.state.cursor = 0;
    if (text.trim() === "") {
      this.render();
      return;
    }
    await this.submit(text);
  }

  private moveLeft(): void {
    if (this.state.cursor === 0) return;
    const chars = [...this.state.input.slice(0, this.state.cursor)];
    chars.pop();
    this.state.cursor = chars.join("").length;
  }

  private moveRight(): void {
    const next = [...this.state.input.slice(this.state.cursor)][0];
    if (next !== undefined) this.state.cursor += next.length;
  }

  private backspace(): void {
    if (this.state.cursor === 0) return;
    const chars = [...this.state.input.slice(0, this.state.cursor)];
    chars.pop();
    const kept = chars.join("");
    this.state.input = kept + this.state.input.slice(this.state.cursor);
    this.state.cursor = kept.length;
    this.state.exitArmed = false;
  }

  private deleteForward(): void {
    const rest = [...this.state.input.slice(this.state.cursor)];
    if (rest.length === 0) return;
    const first = rest[0]!;
    this.state.input = this.state.input.slice(0, this.state.cursor) + this.state.input.slice(this.state.cursor + first.length);
  }

  private complete(): void {
    const value = this.state.input;
    const commands = ["/help", "/status", "/model", "/budget", "/trace", "/receipt", "/new", "/resume", "/quit"];
    if (value.startsWith("/")) {
      const matches = commands.filter((command) => command.startsWith(value));
      if (matches.length === 1) {
        this.state.input = matches[0]!;
        this.state.cursor = this.state.input.length;
      } else if (matches.length > 1) {
        this.info(`completions: ${matches.join("  ")}`);
      }
      this.render();
      return;
    }
    const token = /\S*$/.exec(value)?.[0] ?? "";
    if (token === "") return;
    const slash = token.lastIndexOf("/");
    const dirPart = slash >= 0 ? token.slice(0, slash) : ".";
    const base = slash >= 0 ? token.slice(slash + 1) : token;
    try {
      const entries = readdirSync(resolve(this.opts.cwd, dirPart)).filter((entry) => entry.startsWith(base)).slice(0, 20);
      if (entries.length === 1) {
        const replacement = `${slash >= 0 ? token.slice(0, slash + 1) : ""}${entries[0]}`;
        this.state.input = `${value.slice(0, value.length - token.length)}${replacement}`;
        this.state.cursor = this.state.input.length;
        this.render();
        return;
      }
      if (entries.length > 1) {
        this.info(`paths: ${entries.join("  ")}`);
        return;
      }
    } catch {
      // no completions in this directory
    }
    this.notice("no completion");
  }

  private toggleAllTools(): void {
    const anyCollapsed = this.state.transcript.some((item) => item.kind === "tool" && item.tool.expanded !== true);
    for (const item of this.state.transcript) {
      if (item.kind === "tool") item.tool.expanded = anyCollapsed;
    }
    this.render();
  }
  private handleCtrlC(): void {
    if (this.state.phase === "running") {
      if (this.abort !== null && !this.abort.signal.aborted) {
        this.abort.abort();
        this.notice("cancelling turn…");
      } else {
        this.stop(130);
      }
      return;
    }
    if (this.state.exitArmed) {
      this.stop(130);
      return;
    }
    this.state.exitArmed = true;
    this.notice("press Ctrl+C again to exit");
  }

  private insert(text: string): void {
    this.state.input = this.state.input.slice(0, this.state.cursor) + text + this.state.input.slice(this.state.cursor);
    this.state.cursor += text.length;
    this.state.exitArmed = false;
    this.render();
  }

  private historyMove(delta: number): void {
    if (this.state.history.length === 0) return;
    const next = Math.max(0, Math.min(this.state.history.length, this.state.historyIndex + delta));
    this.state.historyIndex = next;
    this.state.input = next === this.state.history.length ? "" : this.state.history[next] ?? "";
    this.state.cursor = this.state.input.length;
    this.render();
  }

  private toggleLastTool(): void {
    for (let index = this.state.transcript.length - 1; index >= 0; index -= 1) {
      const item = this.state.transcript[index];
      if (item !== undefined && item.kind === "tool") {
        item.tool.expanded = item.tool.expanded !== true;
        this.render();
        return;
      }
    }
  }

  private notice(text: string): void {
    this.state.transcript.push({ kind: "notice", level: "warn", text: sanitize(text) });
    this.render();
  }

  private info(text: string): void {
    this.state.transcript.push({ kind: "info", text: sanitize(text) });
    this.render();
  }

  private onDelta(text: string): void {
    const clean = sanitize(text);
    if (clean === "") return;
    if (this.streamingItem === null) {
      const item: Extract<TranscriptItem, { kind: "assistant" }> = { kind: "assistant", text: "", streaming: true };
      this.streamingItem = item;
      this.state.transcript.push(item);
    }
    this.streamingItem.text += clean;
    this.render();
  }

  private attach(session: Session): void {
    this.unsubscribe?.();
    this.session = session;
    this.unsubscribe = session.subscribe((event) => this.onSessionEvent(event));
  }

  private onSessionEvent(event: SessionEvent): void {
    const data = event.data as Record<string, unknown>;
    this.trackMetrics(event);
    switch (event.type) {
      case "user/message":
        this.state.transcript.push({ kind: "user", text: sanitize(String(data.content ?? "")) });
        break;
      case "assistant/message": {
        const content = sanitize(String(data.content ?? ""));
        if (this.streamingItem !== null) {
          this.streamingItem.text = content;
          this.streamingItem.streaming = false;
          this.streamingItem = null;
        } else if (content.trim() !== "") {
          this.state.transcript.push({ kind: "assistant", text: content });
        }
        break;
      }
      case "tool/call": {
        const callId = String(data.callId ?? "");
        const name = String(data.name ?? "");
        const args = data.arguments !== null && typeof data.arguments === "object" ? (data.arguments as Record<string, unknown>) : {};
        this.startTimes.set(callId, event.time);
        this.callArgs.set(callId, { name, args });
        this.state.transcript.push({ kind: "tool", tool: { callId, name, args: JSON.stringify(args), status: "running", startedAt: event.time } });
        break;
      }
      case "tool/result": {
        const callId = String(data.callId ?? "");
        const text = sanitize(firstText(data));
        const item = [...this.state.transcript].reverse().find((entry) => entry.kind === "tool" && entry.tool.callId === callId);
        if (item !== undefined && item.kind === "tool") {
          const error = data.error as { code?: string } | undefined;
          item.tool.status = data.ok === true ? "ok" : error?.code === "POLICY_DENIED" ? "denied" : "error";
          item.tool.result = text.slice(0, 4000);
          const started = this.startTimes.get(callId);
          if (started !== undefined) item.tool.elapsedMs = event.time - started;
          if (this.callArgs.get(callId)?.name === "research" && data.ok === true) {
            const meta = data.meta as { sources?: unknown; credits?: unknown; cached?: unknown; cardTokens?: unknown; confidence?: unknown } | undefined;
            const sources = Array.isArray(meta?.sources) ? meta?.sources.map(String) : [];
            this.state.status.researchCredits += Number(meta?.credits ?? 0);
            this.state.transcript.push({
              kind: "research",
              text: `${String(meta?.confidence ?? "unknown")} confidence · ${Number(meta?.cardTokens ?? 0)} tokens${meta?.cached === true ? " · cached" : ""} · ${text.slice(0, 220).replace(/\n+/g, " ")}`,
              ...(sources.length === 0 ? {} : { sources }),
            });
          }
        }
        break;
      }
      case "approval/request": {
        const callId = String(data.callId ?? "");
        const toolName = String(data.tool ?? "");
        const args = this.callArgs.get(callId)?.args ?? {};
        this.state.approval = {
          approvalId: String(data.approvalId ?? ""),
          tool: toolName,
          risk: String(data.risk ?? ""),
          preview: sanitize(String(data.preview ?? "")),
          ...(typeof data.reason === "string" ? { reason: data.reason } : {}),
          ...diffFor(toolName, args),
        };
        this.state.phase = "approval";
        break;
      }
      case "approval/decision":
        this.state.approval = null;
        this.state.phase = "running";
        break;
      case "route/changed": {
        const from = formatRef(data.from);
        const to = formatRef(data.to);
        this.state.transcript.push({ kind: "takeover", text: `${from} → ${to} (${String(data.reason ?? "")})` });
        this.state.status.route = to;
        break;
      }
      case "budget/updated":
        this.state.status.llmUsd = Number(data.used ?? this.state.status.llmUsd);
        this.state.status.llmLimit = Number(data.limit ?? this.state.status.llmLimit);
        break;
      case "dlp/blocked":
        this.state.status.dlp = "blocked";
        this.state.transcript.push({ kind: "dlp", text: `${String(data.class ?? "secret")} ${String(data.action ?? "blocked")}` });
        break;
      case "docs/check": {
        const symbols = Array.isArray(data.symbols) ? (data.symbols as string[]).join(", ") : "";
        this.state.transcript.push({ kind: "docs", text: `${String(data.result ?? "unknown")}${symbols === "" ? "" : `: ${symbols}`}` });
        break;
      }
      case "session/error":
        this.state.transcript.push({ kind: "error", text: sanitize(String(data.message ?? "session error")) });
        break;
      default:
        break;
    }
    this.render();
  }

  private trackMetrics(event: SessionEvent): void {
    const data = event.data as Record<string, unknown>;
    if (event.type === "assistant/message") {
      const usage = data.usage as { input?: number; cacheRead?: number } | undefined;
      if (usage !== undefined) {
        const input = Number(usage.input ?? 0);
        const cached = Number(usage.cacheRead ?? 0);
        this.inputTokenTotal += input;
        this.cacheReadTotal += cached;
        this.state.status.cacheHitRate = this.cacheReadTotal / Math.max(1, this.inputTokenTotal + this.cacheReadTotal);
        this.state.status.contextPressure = Math.min(1, input / Math.max(1, this.contextCapTokens));
      }
      const provider = typeof data.provider === "string" ? data.provider : undefined;
      const model = typeof data.model === "string" ? data.model : undefined;
      if (provider !== undefined && model !== undefined) this.state.status.route = `${provider}/${model}`;
    }
    if (event.type === "context/metrics") {
      if (typeof data.capTokens === "number") this.contextCapTokens = Math.max(1, data.capTokens);
      const cleared = Number(data.cleared ?? 0);
      if (cleared > 0) this.state.status.compaction = "cleared";
      else if (data.compactionNetCostUsd !== undefined) this.state.status.compaction = "compacted";
    }
    if (event.type === "dlp/blocked") this.state.status.dlp = String(data.action ?? "blocked");
  }

  private approvalView(): ApprovalView | null {
    const request = this.approvalService.current();
    if (request === null) return null;
    const args = this.callArgs.get(request.callId)?.args ?? {};
    return {
      approvalId: `apr_${request.callId}`,
      tool: request.tool,
      risk: request.risk,
      preview: sanitize(request.preview),
      ...diffFor(request.tool, args),
    };
  }

  private syncBudget(): void {
    const snapshot = this.opts.budgetSnapshot();
    this.state.status.llmUsd = snapshot.usedUsd;
    this.state.status.llmLimit = snapshot.limitUsd;
  }

  private command(line: string): void {
    const [name, ...rest] = line.trim().split(/\s+/);
    const arg = rest.join(" ");
    switch (name) {
      case "/help":
        this.info(
          [
            "/help  /status  /model  /budget  /trace  /receipt  /new  /resume  /quit",
            "Keys: Enter send · ↑↓ history · Esc cancel · Ctrl+C cancel/exit · Ctrl+D quit · Ctrl+L clear · Ctrl+O expand tools · y/n approve",
          ].join("\n"),
        );
        return;
      case "/status":
        this.info(
          `session ${this.session.header.sessionId} · cwd ${this.opts.cwd} · mode ${this.opts.mode} · model ${this.opts.modelAlias} · budget $${this.state.status.llmUsd.toFixed(4)}/$${this.state.status.llmLimit.toFixed(2)} · receipts ${this.state.receipts.length}`,
        );
        return;
      case "/model": {
        if (arg !== "") {
          const chosen = this.state.modelOptions.find((alias) => alias === arg) ?? arg;
          this.state.modelAlias = chosen;
          this.state.status.route = chosen;
          this.info(`model alias set to ${chosen} (next turn)`);
          return;
        }
        this.info(`model alias: ${this.state.modelAlias} · available: ${this.state.modelOptions.join(", ")} · phase routing resolved by Bifrost; the TUI never calls providers directly`);
        return;
      }
      case "/budget": {
        const snapshot = this.opts.budgetSnapshot();
        this.info(`llm used $${snapshot.usedUsd.toFixed(4)} of $${snapshot.limitUsd.toFixed(2)} · remaining $${snapshot.remainingUsd.toFixed(4)} · task $${snapshot.taskUsedUsd.toFixed(4)}/$${snapshot.taskCapUsd.toFixed(2)}`);
        return;
      }
      case "/trace": {
        if (this.state.lastTrace.length === 0) {
          this.info("no trace yet; run a task first");
          return;
        }
        const table = new TuiAdapter().renderTrace(this.state.lastTrace);
        this.info(table);
        return;
      }
      case "/receipt": {
        const receipt = this.state.receipts.at(-1);
        if (receipt === undefined) {
          this.info("no receipt yet; run a task first");
          return;
        }
        this.info(`${receipt.status} · ${receipt.summary} · ${receipt.tokens.total} tokens · $${receipt.llmCostUsd.toFixed(4)} · ${receipt.fallbacks} fallback(s)`);
        return;
      }
      case "/new": {
        this.newSession();
        return;
      }
      case "/resume": {
        if (arg !== "") {
          this.resumeSession(arg);
          return;
        }
        const sessions = this.opts.listSessions();
        if (sessions.length === 0) {
          this.info("no sessions recorded yet");
          return;
        }
        this.state.resumeOptions = sessions;
        this.state.input = "";
        this.state.cursor = 0;
        this.render();
        return;
      }
      case "/quit":
      case "/exit":
        this.stop(0);
        return;
      default:
        this.notice(`unknown command: ${name ?? ""} (try /help)`);
        return;
    }
  }

  private newSession(): void {
    try {
      this.session.append("session/end", { reason: "replaced by /new" });
    } catch {
      // A closed session is still replaceable.
    }
    const next = this.opts.createSession();
    this.attach(next);
    this.session = next;
    this.state.transcript = [];
    this.state.receipts = [];
    this.state.lastTrace = [];
    this.state.approval = null;
    this.state.resumeOptions = null;
    this.opts.resetBudget?.();
    this.state.status.llmUsd = 0;
    this.notice(`new session ${next.header.sessionId}`);
  }

  private resumeSession(id: string): void {
    try {
      const loaded = this.opts.loadSession(id);
      this.attach(loaded);
      this.session = loaded;
      this.state.transcript = replaySessionTranscript(loaded);
      this.state.receipts = [];
      this.state.lastTrace = [];
      this.state.approval = null;
      this.state.resumeOptions = null;
      this.info(`resumed ${loaded.header.sessionId} · ${loaded.all.length} events replayed`);
    } catch (error) {
      this.notice(`resume failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private addHistory(text: string): void {
    if (this.state.history.at(-1) !== text) this.state.history.push(text);
    if (this.state.history.length > 200) this.state.history = this.state.history.slice(-200);
    this.state.historyIndex = this.state.history.length;
    this.persistHistory();
  }

  private historyPath(): string | null {
    return this.opts.historyFile ?? null;
  }

  private loadHistory(): string[] {
    const file = this.opts.historyFile;
    if (file === undefined || !existsSync(file)) return [];
    try {
      return readFileSync(file, "utf8").split("\n").filter((line) => line.trim() !== "").slice(-200);
    } catch {
      return [];
    }
  }

  private persistHistory(): void {
    const file = this.historyPath();
    if (file === null) return;
    try {
      writeFileSync(file, this.state.history.join("\n"), "utf8");
    } catch {
      // history is best-effort
    }
  }
}

/** Replays a loaded session into transcript items (resume must not show an empty screen). */
export function replaySessionTranscript(session: Session, limit = 200): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  const tools = new Map<string, ToolView>();
  for (const event of session.all.slice(-limit)) {
    const data = event.data as Record<string, unknown>;
    switch (event.type) {
      case "user/message":
        items.push({ kind: "user", text: sanitize(String(data.content ?? "")) });
        break;
      case "assistant/message": {
        const content = sanitize(String(data.content ?? ""));
        if (content.trim() !== "") items.push({ kind: "assistant", text: content });
        break;
      }
      case "tool/call": {
        const callId = String(data.callId ?? "");
        const name = String(data.name ?? "");
        const args = JSON.stringify(data.arguments ?? {});
        const tool: ToolView = { callId, name, args, status: "ok" };
        tools.set(callId, tool);
        items.push({ kind: "tool", tool });
        break;
      }
      case "tool/result": {
        const tool = tools.get(String(data.callId ?? ""));
        if (tool !== undefined) {
          const error = data.error as { code?: string } | undefined;
          tool.status = data.ok === true ? "ok" : error?.code === "POLICY_DENIED" ? "denied" : "error";
          tool.result = sanitize(firstText(data)).slice(0, 4000);
        }
        break;
      }
      case "approval/request":
        items.push({ kind: "notice", level: "warn", text: `approval requested: ${String(data.tool ?? "tool")} (${String(data.risk ?? "")})` });
        break;
      case "approval/decision":
        items.push({ kind: "notice", level: "warn", text: `approval ${String(data.decision ?? "deny")}` });
        break;
      case "route/changed":
        items.push({ kind: "takeover", text: `${formatRef(data.from)} → ${formatRef(data.to)} (${String(data.reason ?? "")})` });
        break;
      case "docs/check":
        items.push({ kind: "docs", text: String(data.result ?? "unknown") });
        break;
      case "dlp/blocked":
        items.push({ kind: "dlp", text: `${String(data.class ?? "secret")} ${String(data.action ?? "blocked")}` });
        break;
      case "session/error":
        items.push({ kind: "error", text: sanitize(String(data.message ?? "session error")) });
        break;
      default:
        break;
    }
  }
  return items;
}

/** Lists sessions for /resume, newest first, reading only the first user message. */
export function listSessionEntries(dir: string): TuiSessionEntry[] {
  if (!existsSync(dir)) return [];
  const entries: TuiSessionEntry[] = [];
  for (const entry of readdirSync(dir)) {
    const file = join(dir, entry, "session.jsonl");
    if (!existsSync(file)) continue;
    let label = entry;
    try {
      const lines = readFileSync(file, "utf8").split("\n").filter((line) => line.trim() !== "");
      for (const line of lines) {
        const event = JSON.parse(line) as { type?: string; data?: { content?: string; createdAt?: number } };
        if (event.type === "user/message" && typeof event.data?.content === "string") {
          label = `${entry} · ${event.data.content.slice(0, 60)}`;
          break;
        }
      }
    } catch {
      // keep the id label
    }
    entries.push({ id: entry, label });
  }
  entries.sort((a, b) => (a.id < b.id ? 1 : -1));
  return entries.slice(0, 20);
}
