/**
 * Plain-mode TUI: line REPL for non-TTY runs and `gidorah tui --plain`.
 *
 * No raw mode, no ANSI. Approvals are denied with an explicit notice because
 * there is no interactive channel in a pipe; use the full TUI to approve.
 */
import readline from "node:readline";
import { DenyApprovalService, runTask, type BudgetSnapshot, type RuntimeDeps } from "../../../packages/core/src/runtime.ts";
import { Session } from "../../../packages/core/src/session.ts";
import type { SessionEvent } from "../../../packages/shared/src/types.ts";
import { sanitizeUntrusted } from "./index.ts";
import type { TuiHooks, TuiSessionEntry } from "./app.ts";

export interface PlainTuiOptions {
  session: Session;
  createDeps: (session: Session, hooks: TuiHooks) => RuntimeDeps;
  createSession: () => Session;
  listSessions: () => TuiSessionEntry[];
  loadSession: (id: string) => Session;
  budgetSnapshot: () => BudgetSnapshot;
  cwd: string;
  mode: string;
  modelAlias: string;
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
}

function lineFor(event: SessionEvent): string | null {
  const data = event.data as Record<string, unknown>;
  switch (event.type) {
    case "user/message":
      return `› ${sanitizeUntrusted(String(data.content ?? ""))}`;
    case "assistant/message": {
      const content = sanitizeUntrusted(String(data.content ?? ""));
      return content.trim() === "" ? null : `● ${content}`;
    }
    case "tool/call":
      return `⚙ ${String(data.name ?? "tool")} ${sanitizeUntrusted(JSON.stringify(data.arguments ?? {}))}`;
    case "tool/result": {
      const ok = data.ok === true;
      const error = data.error as { code?: string } | undefined;
      return `  ${ok ? "ok" : error?.code === "POLICY_DENIED" ? "denied" : "error"}${ok ? "" : `: ${sanitizeUntrusted(String(error?.code ?? "failed"))}`}`;
    }
    case "approval/request":
      return `[approval required] ${String(data.tool ?? "tool")} (${String(data.risk ?? "")}): ${sanitizeUntrusted(String(data.preview ?? ""))}`;
    case "approval/decision":
      return `[approval ${String(data.decision ?? "deny")}]`;
    case "route/changed":
      return `[takeover] ${sanitizeUntrusted(JSON.stringify(data.from))} -> ${sanitizeUntrusted(JSON.stringify(data.to))}`;
    case "session/error":
      return `[error] ${sanitizeUntrusted(String(data.message ?? ""))}`;
    default:
      return null;
  }
}

export async function runPlainTui(options: PlainTuiOptions): Promise<number> {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const write = (line: string): void => {
    stdout.write(`${line}\n`);
  };
  let session = options.session;
  write("Gidorah (plain mode) - the governed coding agent");
  write(`cwd: ${options.cwd} · session: ${session.header.sessionId} · mode: ${options.mode} · model: ${options.modelAlias}`);
  write("Type a task, /help for commands, /quit to exit. Approvals are denied in plain mode.");

  const rl = readline.createInterface({ input: stdin, output: stdout, terminal: false });
  let quitting = false;
  try {
    for await (const raw of rl) {
      const text = raw.trim();
      if (text === "") continue;
      if (text === "/quit" || text === "/exit") break;
      if (text === "/help") {
        write("/help /status /model /budget /receipt /new /resume /quit");
        continue;
      }
      if (text === "/status") {
        const snapshot = options.budgetSnapshot();
        write(`session ${session.header.sessionId} · mode ${options.mode} · model ${options.modelAlias} · budget $${snapshot.usedUsd.toFixed(4)}/$${snapshot.limitUsd.toFixed(2)}`);
        continue;
      }
      if (text === "/budget") {
        const snapshot = options.budgetSnapshot();
        write(`llm used $${snapshot.usedUsd.toFixed(4)} of $${snapshot.limitUsd.toFixed(2)} · remaining $${snapshot.remainingUsd.toFixed(4)}`);
        continue;
      }
      if (text === "/new") {
        session = options.createSession();
        write(`new session ${session.header.sessionId}`);
        continue;
      }
      if (text.startsWith("/resume")) {
        const id = text.slice("/resume".length).trim();
        if (id === "") {
          const sessions = options.listSessions();
          write(sessions.length === 0 ? "no sessions recorded yet" : sessions.map((entry, index) => `${index + 1}. ${entry.label}`).join("\n"));
        } else {
          try {
            session = options.loadSession(id);
            write(`resumed ${session.header.sessionId}`);
          } catch (error) {
            write(`resume failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        continue;
      }
      if (text.startsWith("/")) {
        write(`unknown command: ${text}`);
        continue;
      }

      const unsubscribe = session.subscribe((event) => {
        const line = lineFor(event);
        if (line !== null) write(line);
      });
      try {
        const deps = options.createDeps(session, { approval: new DenyApprovalService() });
        const result = await runTask(session, text, deps);
        write(`receipt: ${result.receipt.status} · ${result.receipt.tokens.total} tokens · $${result.receipt.llmCostUsd.toFixed(4)} · ${result.receipt.summary}`);
      } catch (error) {
        write(`error: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        unsubscribe();
      }
    }
  } finally {
    quitting = true;
    rl.close();
  }
  void quitting;
  return 0;
}
