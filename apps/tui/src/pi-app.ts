/**
 * Interactive Gidorah session on pi-tui (TTY path).
 *
 * Framework owns rendering, viewport, composer, overlays and the picker. This
 * module owns session/event projection, runtime wiring, approvals and slash
 * commands. The legacy non-TTY app remains for plain mode/demo/tests.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Markdown, ProcessTerminal, Text, type Component, type Terminal } from "@earendil-works/pi-tui";
import { runTask, type BudgetSnapshot, type RuntimeDeps } from "../../../packages/core/src/runtime.ts";
import { Session } from "../../../packages/core/src/session.ts";
import type { Receipt, SessionEvent, TraceRecord } from "../../../packages/shared/src/types.ts";
import { TuiAdapter } from "./adapter.ts";
import { InteractiveApprovalService } from "./approval.ts";
import { statusLine, type StatusState } from "./index.ts";
import { sanitizeUntrusted } from "./index.ts";
import type { TranscriptItem } from "./layout.ts";
import { GidorahShell, type ApprovalPayload } from "./pi-shell.ts";
import { listSessionEntries, replaySessionTranscript, type TuiHooks, type TuiSessionEntry } from "./app.ts";

export interface PiTuiOptions {
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
  researchLimit?: number;
  maxSteps?: number;
  historyFile?: string;
  color?: boolean;
  terminal?: Terminal;
}

interface State {
  transcript: TranscriptItem[];
  phase: "idle" | "running" | "approval" | "exited";
  approval: { id: string; tool: string; risk: string; diff?: ApprovalPayload["diff"]; hint?: string } | null;
  receipts: Receipt[];
  trace: TraceRecord[];
  status: StatusState;
  modelAlias: string;
  modelOptions: string[];
  exitArmed: boolean;
}

function sanitize(text: string): string {
  return sanitizeUntrusted(text);
}

function ref(value: unknown): string {
  if (typeof value === "string") return value;
  if (value !== null && typeof value === "object") {
    const r = value as { provider?: string; model?: string };
    if (r.provider !== undefined && r.model !== undefined) return `${r.provider}/${r.model}`;
  }
  return "unknown";
}

function firstText(data: Record<string, unknown>): string {
  if (Array.isArray(data.content)) {
    for (const block of data.content) {
      if (block !== null && typeof block === "object" && typeof (block as { text?: unknown }).text === "string") return (block as { text: string }).text;
    }
  }
  return "";
}

export class PiTuiApp {
  private readonly opts: PiTuiOptions;
  private readonly shell: GidorahShell;
  private readonly approvalService = new InteractiveApprovalService();
  private readonly terminal: Terminal;
  private session: Session;
  private state: State;
  private unsubscribe: (() => void) | null = null;
  private abort: AbortController | null = null;
  private streaming: Extract<TranscriptItem, { kind: "assistant" }> | null = null;
  private toolTimes = new Map<string, number>();
  private toolArgs = new Map<string, { name: string; args: Record<string, unknown> }>();
  private shownApprovalId: string | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private done: ((code: number) => void) | null = null;
  private history: string[];
  private cacheRead = 0;
  private inputTokens = 0;
  private contextCap = 128_000;

  constructor(options: PiTuiOptions) {
    this.opts = options;
    this.session = options.session;
    this.terminal = options.terminal ?? new ProcessTerminal();
    this.shell = new GidorahShell(this.terminal, {
      color: options.color === true,
      onSubmit: (text) => void this.submit(text),
      onQuit: () => this.stop(0),
      onInterrupt: () => this.interrupt(),
      onScroll: (direction) => this.shell.page(direction),
    });
    this.history = this.loadHistory();
    for (const entry of this.history) this.shell.editor.addToHistory(entry);
    this.state = {
      transcript: [],
      phase: "idle",
      approval: null,
      receipts: [],
      trace: [],
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
      modelAlias: options.modelAlias,
      modelOptions: options.availableAliases ?? [options.modelAlias],
      exitArmed: false,
    };
    this.shell.tui.addInputListener((data) => {
      if (data === "\u000f") {
        this.toggleLastTool();
        return { consume: true };
      }
      if (data === "\u0005") {
        this.toggleAllTools();
        return { consume: true };
      }
      if (data === "\t") {
        this.complete();
        return { consume: true };
      }
      return undefined;
    });
    this.attach(this.session);
    this.sync();
  }

  start(): Promise<number> {
    this.shell.start();
    this.sync();
    return new Promise((resolve) => {
      this.done = resolve;
    });
  }

  stop(code = 0): void {
    if (this.state.phase === "exited") return;
    if (this.state.phase === "running") {
      try {
        this.session.closeOpenBoundaries();
      } catch {
        // already closed
      }
    }
    this.state.phase = "exited";
    this.approvalService.denyAll();
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.syncTimer !== null) clearTimeout(this.syncTimer);
    this.shell.stop();
    this.persistHistory();
    this.done?.(code);
    this.done = null;
  }

  /** Test/demo access. */
  shellForTest(): GidorahShell {
    return this.shell;
  }

  pendingApproval(): boolean {
    return this.approvalService.current() !== null || this.state.approval !== null;
  }

  phase(): State["phase"] {
    return this.state.phase;
  }

  transcript(): readonly TranscriptItem[] {
    return this.state.transcript;
  }

  respond(decision: "allow" | "deny"): boolean {
    const ok = this.approvalService.respond(decision);
    if (ok) {
      this.state.approval = null;
      this.state.phase = "running";
      this.shownApprovalId = null;
      this.shell.hideApproval();
      this.sync();
    }
    return ok;
  }

  async submit(raw: string): Promise<void> {
    const task = raw.trim();
    if (task === "") return;
    if (task.startsWith("/")) {
      this.command(task);
      return;
    }
    if (this.state.phase === "running") {
      this.info("a turn is already running");
      return;
    }
    this.state.phase = "running";
    this.state.exitArmed = false;
    this.abort = new AbortController();
    this.streaming = null;
    this.shell.setEditorText("");
    this.shell.editor.addToHistory(task);
    this.addHistory(task);
    this.shell.editor.disableSubmit = true;
    this.sync();
    try {
      const hooks: TuiHooks = {
        approval: this.approvalService,
        modelAlias: this.state.modelAlias,
        onModelDelta: (delta) => this.onDelta(delta),
        signal: this.abort.signal,
        ...(this.opts.maxSteps === undefined ? {} : { maxSteps: this.opts.maxSteps }),
      };
      const result = await runTask(this.session, task, this.opts.createDeps(this.session, hooks));
      this.state.trace = result.trace;
      this.state.receipts.push(result.receipt);
      this.state.transcript.push({ kind: "receipt", text: `${result.receipt.status} · ${result.receipt.tokens.total} tokens · $${result.receipt.llmCostUsd.toFixed(4)} · ${result.receipt.fallbacks} fallback(s) · ${result.receipt.summary}` });
      this.syncBudget();
    } catch (error) {
      this.state.transcript.push({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      this.state.phase = "idle";
      this.state.approval = null;
      this.shownApprovalId = null;
      this.approvalService.denyAll();
      this.shell.hideApproval();
      this.abort = null;
      this.streaming = null;
      this.shell.editor.disableSubmit = false;
      this.shell.focusEditor();
      this.sync();
    }
  }

  private toggleLastTool(): void {
    for (let index = this.state.transcript.length - 1; index >= 0; index -= 1) {
      const item = this.state.transcript[index];
      if (item !== undefined && item.kind === "tool") {
        item.tool.expanded = item.tool.expanded !== true;
        this.sync();
        return;
      }
    }
  }

  private toggleAllTools(): void {
    const anyCollapsed = this.state.transcript.some((item) => item.kind === "tool" && item.tool.expanded !== true);
    for (const item of this.state.transcript) if (item.kind === "tool") item.tool.expanded = anyCollapsed;
    this.sync();
  }

  private complete(): void {
    const value = this.shell.getEditorText();
    const commands = ["/help", "/status", "/model", "/budget", "/trace", "/receipt", "/new", "/resume", "/quit"];
    if (value.startsWith("/")) {
      const matches = commands.filter((command) => command.startsWith(value));
      if (matches.length === 1) this.shell.setEditorText(matches[0]!);
      else if (matches.length > 1) this.info(`completions: ${matches.join("  ")}`);
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
        this.shell.setEditorText(`${value.slice(0, value.length - token.length)}${slash >= 0 ? token.slice(0, slash + 1) : ""}${entries[0]}`);
        return;
      }
      if (entries.length > 1) {
        this.info(`paths: ${entries.join("  ")}`);
        return;
      }
    } catch {
      // no completions
    }
  }

  private interrupt(): void {
    if (this.state.phase === "running") {
      if (this.abort !== null && !this.abort.signal.aborted) {
        this.abort.abort();
        this.info("cancelling turn…");
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
    this.info("press Ctrl+C again to exit");
  }

  private onDelta(text: string): void {
    const clean = sanitize(text);
    if (clean === "") return;
    if (this.streaming === null) {
      const item: Extract<TranscriptItem, { kind: "assistant" }> = { kind: "assistant", text: "", streaming: true };
      this.streaming = item;
      this.state.transcript.push(item);
    }
    this.streaming.text += clean;
    this.requestSync();
  }

  private attach(session: Session): void {
    this.unsubscribe?.();
    this.session = session;
    this.unsubscribe = session.subscribe((event) => this.onEvent(event));
  }

  private onEvent(event: SessionEvent): void {
    const data = event.data as Record<string, unknown>;
    this.metrics(event);
    switch (event.type) {
      case "user/message":
        this.state.transcript.push({ kind: "user", text: sanitize(String(data.content ?? "")) });
        break;
      case "assistant/message": {
        const content = sanitize(String(data.content ?? ""));
        if (this.streaming !== null) {
          this.streaming.text = content;
          this.streaming.streaming = false;
          this.streaming = null;
        } else if (content.trim() !== "") this.state.transcript.push({ kind: "assistant", text: content });
        break;
      }
      case "tool/call": {
        const callId = String(data.callId ?? "");
        const name = String(data.name ?? "");
        const args = data.arguments !== null && typeof data.arguments === "object" ? (data.arguments as Record<string, unknown>) : {};
        this.toolTimes.set(callId, event.time);
        this.toolArgs.set(callId, { name, args });
        this.state.transcript.push({ kind: "tool", tool: { callId, name, args: JSON.stringify(args), status: "running", startedAt: event.time } });
        break;
      }
      case "tool/result": {
        const callId = String(data.callId ?? "");
        const text = sanitize(firstText(data));
        const item = [...this.state.transcript].reverse().find((e) => e.kind === "tool" && e.tool.callId === callId);
        if (item !== undefined && item.kind === "tool") {
          const error = data.error as { code?: string } | undefined;
          item.tool.status = data.ok === true ? "ok" : error?.code === "POLICY_DENIED" ? "denied" : "error";
          item.tool.result = text.slice(0, 4000);
          const started = this.toolTimes.get(callId);
          if (started !== undefined) item.tool.elapsedMs = event.time - started;
          if (this.toolArgs.get(callId)?.name === "research" && data.ok === true) {
            const meta = data.meta as { sources?: unknown; credits?: unknown; cardTokens?: unknown; confidence?: unknown } | undefined;
            const sources = Array.isArray(meta?.sources) ? meta.sources.map(String) : [];
            this.state.status.researchCredits += Number(meta?.credits ?? 0);
            this.state.transcript.push({ kind: "research", text: `${String(meta?.confidence ?? "unknown")} confidence · ${Number(meta?.cardTokens ?? 0)} tokens`, ...(sources.length === 0 ? {} : { sources }) });
          }
        }
        break;
      }
      case "approval/request": {
        const id = String(data.approvalId ?? "");
        const callId = String(data.callId ?? "");
        const tool = String(data.tool ?? "");
        const args = this.toolArgs.get(callId)?.args ?? {};
        const diff = tool === "edit" && typeof args.find === "string" && typeof args.replace === "string"
          ? [{ kind: "path" as const, text: String(args.path ?? "") }, ...String(args.find).split("\n").map((text) => ({ kind: "remove" as const, text })), ...String(args.replace).split("\n").map((text) => ({ kind: "add" as const, text }))]
          : tool === "bash" && typeof args.command === "string"
            ? [{ kind: "context" as const, text: String(args.command) }]
            : undefined;
        this.state.approval = { id, tool, risk: String(data.risk ?? ""), ...(diff === undefined ? {} : { diff }) };
        this.state.phase = "approval";
        if (this.shownApprovalId !== id) {
          this.shownApprovalId = id;
          this.shell.showApproval({ tool, risk: String(data.risk ?? ""), ...(diff === undefined ? {} : { diff }), queueCount: this.approvalService.pendingCount() }, (decision) => this.respond(decision));
        }
        break;
      }
      case "approval/decision":
        this.state.approval = null;
        this.state.phase = "running";
        this.shownApprovalId = null;
        this.shell.hideApproval();
        break;
      case "route/changed":
        this.state.transcript.push({ kind: "takeover", text: `${ref(data.from)} → ${ref(data.to)} (${String(data.reason ?? "")})` });
        this.state.status.route = ref(data.to);
        break;
      case "budget/updated":
        this.state.status.llmUsd = Number(data.used ?? this.state.status.llmUsd);
        this.state.status.llmLimit = Number(data.limit ?? this.state.status.llmLimit);
        break;
      case "dlp/blocked":
        this.state.status.dlp = "blocked";
        this.state.transcript.push({ kind: "dlp", text: `${String(data.class ?? "secret")} ${String(data.action ?? "blocked")}` });
        break;
      case "docs/check":
        this.state.transcript.push({ kind: "docs", text: String(data.result ?? "unknown") });
        break;
      case "session/error":
        this.state.transcript.push({ kind: "error", text: sanitize(String(data.message ?? "session error")) });
        break;
      default:
        break;
    }
    this.requestSync();
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
        this.state.status.cacheHitRate = this.cacheRead / Math.max(1, this.inputTokens + this.cacheRead);
        this.state.status.contextPressure = Math.min(1, input / Math.max(1, this.contextCap));
      }
      const provider = typeof data.provider === "string" ? data.provider : undefined;
      const model = typeof data.model === "string" ? data.model : undefined;
      if (provider !== undefined && model !== undefined) this.state.status.route = `${provider}/${model}`;
    }
    if (event.type === "context/metrics") {
      if (typeof data.capTokens === "number") this.contextCap = Math.max(1, data.capTokens);
      const cleared = Number(data.cleared ?? 0);
      if (cleared > 0) this.state.status.compaction = "cleared";
      else if (data.compactionNetCostUsd !== undefined) this.state.status.compaction = "compacted";
    }
  }

  private syncBudget(): void {
    const snapshot = this.opts.budgetSnapshot();
    this.state.status.llmUsd = snapshot.usedUsd;
    this.state.status.llmLimit = snapshot.limitUsd;
  }

  private requestSync(): void {
    if (this.syncTimer !== null) return;
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.sync();
    }, 16);
  }

  private sync(): void {
    if (this.state.phase === "exited") return;
    this.shell.setHeader([
      "Gidorah  the governed coding agent",
      `cwd: ${this.opts.cwd}  ·  branch: ${this.opts.branch}  ·  session: ${this.session.header.sessionId}  ·  mode: ${this.opts.mode}  ·  model: ${this.state.modelAlias}`,
    ]);
    this.shell.setStatus(statusLine(this.state.status, this.opts.color === true));
    this.shell.setFooter([this.state.phase === "approval" ? "[y] allow  [n] deny  [Esc] deny" : this.state.phase === "running" ? "running…  Ctrl+C cancel  Ctrl+O expand  PgUp/PgDn scroll" : "Enter send  ↑↓ history  Tab complete  Ctrl+O tools  Ctrl+D quit  PgUp/PgDn scroll"]);
    this.shell.setTranscriptComponents(this.components());
  }

  private components(): Component[] {
    const out: Component[] = [];
    for (const item of this.state.transcript) {
      switch (item.kind) {
        case "user":
          out.push(new Text(`› ${item.text}`, 0, 0));
          break;
        case "assistant":
          out.push(new Markdown(item.text, 0, 0, { heading: (t) => t, link: (t) => t, linkUrl: (t) => t, code: (t) => t, codeBlock: (t) => t, codeBlockBorder: (t) => t, quote: (t) => t, quoteBorder: (t) => t, hr: (t) => t, listBullet: (t) => t, bold: (t) => t, italic: (t) => t, strikethrough: (t) => t, underline: (t) => t }));
          break;
        case "tool": {
          const lines = [`⚙ ${item.tool.name}(${this.shortArgs(item.tool.args)}) [${item.tool.status}${item.tool.elapsedMs === undefined ? "" : ` ${Math.round(item.tool.elapsedMs)}ms`}]`];
          if (item.tool.result !== undefined && item.tool.result !== "") for (const line of item.tool.result.split("\n").slice(0, item.tool.expanded === true ? 40 : 3)) lines.push(`  ${line}`);
          out.push(new Text(lines.join("\n"), 0, 0));
          break;
        }
        case "research":
          out.push(new Text(`≈ research: ${item.text}${item.sources === undefined ? "" : `\n  sources: ${item.sources.join(", ")}`}`, 0, 0));
          break;
        case "notice":
          out.push(new Text(`! ${item.text}`, 0, 0));
          break;
        case "receipt":
          out.push(new Text(`✓ receipt: ${item.text}`, 0, 0));
          break;
        case "error":
          out.push(new Text(`✖ ${item.text}`, 0, 0));
          break;
        case "dlp":
          out.push(new Text(`⛨ dlp: ${item.text}`, 0, 0));
          break;
        case "docs":
          out.push(new Text(`✎ docs guard: ${item.text}`, 0, 0));
          break;
        case "takeover":
          out.push(new Text(`⇄ takeover: ${item.text}`, 0, 0));
          break;
        case "info":
          out.push(new Text(item.text, 0, 0));
          break;
      }
    }
    return out;
  }

  private shortArgs(args: string): string {
    try {
      const parsed = JSON.parse(args) as Record<string, unknown>;
      if (typeof parsed.path === "string") return parsed.path;
      if (typeof parsed.command === "string") return parsed.command;
      return Object.keys(parsed).slice(0, 2).join(",");
    } catch {
      return args.slice(0, 60);
    }
  }

  private command(line: string): void {
    const [name, ...rest] = line.trim().split(/\s+/);
    const arg = rest.join(" ");
    switch (name) {
      case "/help":
        this.info("/help  /status  /model  /budget  /trace  /receipt  /new  /resume  /quit\nEnter send · ↑↓ history · PgUp/PgDn scroll · Ctrl+C cancel · Ctrl+D quit · y/n approve");
        return;
      case "/status":
        this.info(`session ${this.session.header.sessionId} · cwd ${this.opts.cwd} · mode ${this.opts.mode} · model ${this.state.modelAlias} · budget $${this.state.status.llmUsd.toFixed(4)}/$${this.state.status.llmLimit.toFixed(2)}`);
        return;
      case "/model":
        if (arg !== "") {
          this.state.modelAlias = this.state.modelOptions.find((alias) => alias === arg) ?? arg;
          this.info(`model alias set to ${this.state.modelAlias}`);
          return;
        }
        this.info(`model ${this.state.modelAlias} · available ${this.state.modelOptions.join(", ")}`);
        return;
      case "/budget": {
        const snapshot = this.opts.budgetSnapshot();
        this.info(`llm $${snapshot.usedUsd.toFixed(4)}/$${snapshot.limitUsd.toFixed(2)} remaining $${snapshot.remainingUsd.toFixed(4)}`);
        return;
      }
      case "/trace":
        this.info(this.state.trace.length === 0 ? "no trace yet; run a task first" : new TuiAdapter().renderTrace(this.state.trace));
        return;
      case "/receipt": {
        const receipt = this.state.receipts.at(-1);
        this.info(receipt === undefined ? "no receipt yet; run a task first" : `${receipt.status} · ${receipt.tokens.total} tokens · $${receipt.llmCostUsd.toFixed(4)} · ${receipt.summary}`);
        return;
      }
      case "/new": {
        this.session.append("session/end", { reason: "replaced by /new" });
        const next = this.opts.createSession();
        this.attach(next);
        this.state.transcript = [];
        this.state.receipts = [];
        this.state.trace = [];
        this.opts.resetBudget?.();
        this.state.status.llmUsd = 0;
        this.info(`new session ${next.header.sessionId}`);
        return;
      }
      case "/resume": {
        if (arg !== "") {
          this.resumeSession(arg);
          return;
        }
        const sessions = listSessionEntries(this.session.file.replace(/[\\/]ses_[^\\/]+[\\/]session\.jsonl$/, ""));
        if (sessions.length === 0) {
          this.info("no sessions recorded yet");
          return;
        }
        this.shell.showPicker(sessions.map((entry) => ({ label: entry.label, value: entry.id })), (id) => this.resumeSession(id), () => this.info("resume cancelled"));
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

  private resumeSession(id: string): void {
    try {
      const loaded = this.opts.loadSession(id);
      this.attach(loaded);
      this.state.transcript = replaySessionTranscript(loaded);
      this.state.receipts = [];
      this.state.trace = [];
      this.state.approval = null;
      this.state.phase = "idle";
      this.shell.hidePicker();
      this.info(`resumed ${loaded.header.sessionId} · ${loaded.all.length} events replayed`);
    } catch (error) {
      this.info(`resume failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private info(text: string): void {
    this.state.transcript.push({ kind: "info", text: sanitize(text) });
    this.sync();
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
}

export type { TuiSessionEntry };
