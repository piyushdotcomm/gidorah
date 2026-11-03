/**
 * Interactive Gidorah TUI.
 *
 * One Session across turns. The runtime appends to the session; the app
 * subscribes to the stream and projects it to transcript items while the model
 * streams deltas through RuntimeDeps.onModelDelta. Input is raw-mode keypress;
 * plain/non-TTY operation is handled by plain.ts.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readdirSync } from "node:fs";
import readline from "node:readline";
import { runTask, type ApprovalService, type BudgetSnapshot, type RuntimeDeps } from "../../../packages/core/src/runtime.ts";
import { Session } from "../../../packages/core/src/session.ts";
import type { Receipt, SessionEvent, TraceRecord } from "../../../packages/shared/src/types.ts";
import { TuiAdapter } from "./adapter.ts";
import { InteractiveApprovalService } from "./approval.ts";
import { classifyKey, type KeyInfo } from "./keys.ts";
import { renderScreen, type ApprovalView, type TranscriptItem, type TuiView } from "./layout.ts";
import { sanitizeUntrusted, type StatusState } from "./index.ts";

export interface TuiHooks {
  approval: ApprovalService;
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
    return { diff: [{ kind: "path", text: "shell" }, { kind: "context", text: args.command }] };
  }
  if (tool === "write" && typeof args.path === "string") {
    const body = typeof args.content === "string" ? args.content : "";
    return {
      diff: [{ kind: "path", text: args.path }, ...body.split("\n").slice(0, 10).map((line) => ({ kind: "add" as const, text: line }))],
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
  private done: ((code: number) => void) | null = null;

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
    this.io.stdout.write("\u001b[?1049h\u001b[?25l");
    readline.emitKeypressEvents(this.io.stdin);
    this.io.stdin.setRawMode(true);
    this.io.stdin.resume();
    this.keyListener = (str, key) => this.handleKey(str, key);
    this.io.stdin.on("keypress", this.keyListener);
    this.resizeListener = () => {
      this.state.status;
      this.paint(true);
    };
    this.io.stdout.on("resize", this.resizeListener);
    this.paint(true);
    return new Promise((resolve) => {
      this.done = resolve;
    });
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
      case "escape":
        if (this.state.resumeOptions !== null) this.state.resumeOptions = null;
        else {
          this.state.input = "";
          this.state.cursor = 0;
        }
        this.render();
        return;
      case "enter":
        void this.handleEnter();
        return;
      case "up":
        this.historyMove(-1);
        return;
      case "down":
        this.historyMove(1);
        return;
      case "left":
        this.state.cursor = Math.max(0, this.state.cursor - 1);
        this.render();
        return;
      case "right":
        this.state.cursor = Math.min(this.state.input.length, this.state.cursor + 1);
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
        if (this.state.cursor > 0) {
          this.state.input = this.state.input.slice(0, this.state.cursor - 1) + this.state.input.slice(this.state.cursor);
          this.state.cursor -= 1;
          this.state.exitArmed = false;
          this.render();
        }
        return;
      case "delete":
        if (this.state.cursor < this.state.input.length) {
          this.state.input = this.state.input.slice(0, this.state.cursor) + this.state.input.slice(this.state.cursor + 1);
          this.render();
        }
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
    this.state.phase = "exited";
    this.approvalService.denyAll();
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.interactive) {
      if (this.keyListener !== null) this.io.stdin.off("keypress", this.keyListener);
      if (this.resizeListener !== null) this.io.stdout.off("resize", this.resizeListener);
      try {
        this.io.stdin.setRawMode(false);
      } catch {
        // already restored
      }
      this.io.stdin.pause();
      this.io.stdout.write("\u001b[?25h\u001b[?1049l");
    }
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
      modelAlias: this.opts.modelAlias,
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
    if (!this.interactive) return;
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    setTimeout(() => {
      this.renderScheduled = false;
      this.paint(false);
    }, 16);
  }

  private paint(clear: boolean): void {
    const screen = this.view();
    const width = this.io.stdout.columns ?? screen.width;
    const height = this.io.stdout.rows ?? screen.height;
    this.io.stdout.write(`${clear ? "\u001b[2J\u001b[1;1H" : "\u001b[1;1H"}${renderScreen({ ...screen, width, height })}`);
  }

  private async handleEnter(): Promise<void> {
    if (this.state.resumeOptions !== null) {
      const index = Number.parseInt(this.state.input.trim(), 10);
      const chosen = Number.isFinite(index) ? this.state.resumeOptions[index - 1] : undefined;
      if (chosen !== undefined) {
        this.resumeSession(chosen.id);
        return;
      }
      this.notice("enter a listed number, or Esc to cancel");
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
            const meta = data.meta as { sources?: unknown } | undefined;
            const sources = Array.isArray(meta?.sources) ? meta?.sources.map(String) : [];
            this.state.transcript.push({ kind: "research", text: text.slice(0, 300), ...(sources.length === 0 ? {} : { sources }) });
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
      case "/model":
        this.info(`model alias: ${this.opts.modelAlias} (phase routing resolved by Bifrost; the TUI never calls providers directly)`);
        return;
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
      this.state.transcript = [];
      this.state.receipts = [];
      this.state.lastTrace = [];
      this.state.approval = null;
      this.state.resumeOptions = null;
      this.info(`resumed ${loaded.header.sessionId}`);
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
