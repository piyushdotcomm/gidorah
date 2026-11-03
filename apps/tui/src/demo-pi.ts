/**
 * Deterministic pi-tui demo frames (`tui --demo-pi` generator).
 * Uses the real shell components with a fake terminal; no network, no runtime.
 */
import type { Terminal } from "@earendil-works/pi-tui";
import { GidorahShell } from "./pi-shell.ts";

class DemoTerminal implements Terminal {
  columns = 100;
  rows = 34;
  kittyProtocolActive = false;
  start(): void {}
  stop(): void {}
  async drainInput(): Promise<void> {}
  write(): void {}
  moveBy(): void {}
  hideCursor(): void {}
  showCursor(): void {}
  clearLine(): void {}
  clearFromCursor(): void {}
  clearScreen(): void {}
  setTitle(): void {}
  setProgress(): void {}
}

export function renderPiDemo(): string {
  const shell = new GidorahShell(new DemoTerminal(), { color: false, onSubmit: () => {}, onQuit: () => {}, onInterrupt: () => {}, onScroll: () => {} });
  const out: string[] = ["# Gidorah pi-tui demo", "", "Deterministic frames rendered by pi-tui components with a fake terminal; no network."];
  const frame = (title: string): void => {
    out.push("", `### ${title}`, "```text", shell.snapshot(100, 34), "```");
  };
  shell.setHeader([
    "Gidorah  the governed coding agent",
    "cwd: /repo  ·  branch: main  ·  session: ses_demo  ·  mode: mock  ·  model: gidorah-auto",
  ]);
  shell.setStatus("mode: mock  route: fireworks/glm-5p3-flash  budget: $0.0016/$1.00  research: 1/50  dlp: clean  cache: 12%  context: 8%  compaction: off");
  shell.addText("› patch greeting.txt and verify the runtime");
  shell.addMarkdown("I'll patch `greeting.txt` and then check the runtime.\n\n- read the file\n- apply the edit\n- run the test");
  shell.addToolCard({ name: "edit", args: "greeting.txt  hello -> hello, world", status: "ok", elapsedMs: 19, result: "patched greeting.txt (5 -> 12 chars)" });
  frame("1. Header, status, Markdown assistant, tool card");
  shell.showApproval({
    tool: "edit",
    risk: "write",
    diff: [
      { kind: "path", text: "greeting.txt" },
      { kind: "remove", text: "hello" },
      { kind: "add", text: "hello, world" },
    ],
    queueCount: 1,
  }, () => {});
  frame("2. Edit approval overlay with numbered diff");
  shell.hideApproval();
  shell.addToolCard({ name: "bash", args: "npm test -- --watch", status: "denied", elapsedMs: 4, result: "Denied by policy" });
  shell.addText("≈ research: high confidence · 180 tokens\n  sources: https://nodejs.org/api/globals.html#abortsignalany");
  shell.addText("⇄ takeover: fireworks/deepseek-v4p1-flash → fireworks/glm-5p3-flash (fallback #1)");
  shell.addReceipt("success · 2000 tokens · $0.0016 · 1 fallback(s)");
  frame("3. Denied shell card, research card, takeover, receipt");
  shell.addText("· session ses_demo · cwd /repo · mode mock · model gidorah-auto · budget $0.0016/$1.00");
  shell.addText("· explore: fireworks/glm-5p3-flash · 500 tokens · $0.000400 · fallback no");
  shell.addText("· success · 2000 tokens · $0.0016 · 1 fallback(s)");
  frame("4. /status, /trace, /receipt output");
  shell.showPicker([
    { label: "ses_demo · patch greeting.txt and verify the runtime", value: "ses_demo" },
    { label: "ses_old · summarize what you changed", value: "ses_old" },
  ], () => {}, () => {});
  frame("5. Searchable /resume picker");
  shell.hidePicker();
  shell.addText("model gidorah-auto · available gidorah-auto, fireworks/accounts/fireworks/models/deepseek-v4p1-flash, gidorah-local");
  frame("6. /model aliases");
  out.push("", "Frames rendered by pi-tui components with a fake terminal (`renderPiDemo`). The interactive path uses `ProcessTerminal`; this artifact is deterministic and offline.");
  return `${out.join("\n")}\n`;
}
