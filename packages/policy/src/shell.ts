/**
 * Shell command lexer and classifier (agent-runtime.md §3).
 *
 * A real lexer, not a regex: quotes, escapes, subshells, operators, and
 * redirections are tokenized. Every segment must be on the read-only allowlist
 * for automatic allowance; dynamic construction (`$(...)`, backticks, `${}`)
 * always forces approval; network-capable commands are identified so
 * confidential mode can deny them.
 */

export interface ShellSegment {
  argv: string[];
  raw: string;
  redirected: boolean;
}

export interface ShellAnalysis {
  segments: ShellSegment[];
  dynamic: boolean;
  redirected: boolean;
  network: boolean;
  readOnly: boolean;
  reason: string;
}

const READ_ONLY_SHELL = new Set(["ls", "cat", "head", "tail", "wc", "pwd", "echo", "true", "stat", "file", "which", "type"]);
const READ_ONLY_GIT = new Set(["status", "diff", "log", "show", "rev-parse", "ls-files"]);
const GIT_MUTATIONS = new Set([
  "add",
  "commit",
  "push",
  "reset",
  "checkout",
  "merge",
  "rebase",
  "clean",
  "stash",
  "pull",
  "fetch",
  "clone",
  "tag",
  "cherry-pick",
  "revert",
]);
const NETWORK_COMMANDS = new Set(["curl", "wget", "ssh", "scp", "nc", "ncat", "telnet", "ftp", "sftp", "rsync"]);
const NETWORK_GIT = new Set(["push", "pull", "fetch", "clone", "ls-remote", "submodule"]);
const PACKAGE_NETWORK = new Set(["install", "add", "update", "publish", "upgrade", "i", "ci"]);

export function tokenizeShell(command: string): { segments: string[][]; dynamic: boolean; redirected: boolean } {
  const segments: string[][] = [];
  let current: string[] = [];
  let token = "";
  let hasToken = false;
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let dynamic = false;
  let redirected = false;

  const pushToken = (): void => {
    if (hasToken) {
      current.push(token);
      token = "";
      hasToken = false;
    }
  };
  const pushSegment = (): void => {
    pushToken();
    if (current.length > 0) segments.push(current);
    current = [];
  };

  for (let i = 0; i < command.length; i += 1) {
    const char = command[i]!;
    if (escaped) {
      token += char;
      hasToken = true;
      escaped = false;
      continue;
    }
    if (inSingle) {
      if (char === "'") inSingle = false;
      else {
        token += char;
        hasToken = true;
      }
      continue;
    }
    if (inDouble) {
      if (char === '"') {
        inDouble = false;
        continue;
      }
      if (char === "\\") {
        const next = command[i + 1];
        if (next !== undefined && '"\\$`'.includes(next)) {
          token += next;
          hasToken = true;
          i += 1;
        } else {
          token += char;
          hasToken = true;
        }
        continue;
      }
      if (char === "$" || char === "`") dynamic = true;
      token += char;
      hasToken = true;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "'") {
      inSingle = true;
      hasToken = true;
      continue;
    }
    if (char === '"') {
      inDouble = true;
      hasToken = true;
      continue;
    }
    if (char === "`") {
      dynamic = true;
      token += char;
      hasToken = true;
      continue;
    }
    if (char === "$" && (command[i + 1] === "(" || command[i + 1] === "{")) {
      dynamic = true;
      token += char;
      hasToken = true;
      continue;
    }
    if (char === " " || char === "\t") {
      pushToken();
      continue;
    }
    if (char === "\n" || char === ";") {
      pushSegment();
      continue;
    }
    if (char === "&" && command[i + 1] === "&") {
      pushSegment();
      i += 1;
      continue;
    }
    if (char === "|" && command[i + 1] === "|") {
      pushSegment();
      i += 1;
      continue;
    }
    if (char === "|") {
      pushSegment();
      continue;
    }
    if (char === ">" || char === "<") {
      redirected = true;
      continue;
    }
    token += char;
    hasToken = true;
  }
  pushSegment();
  return { segments, dynamic, redirected };
}

function gitSegment(argv: string[]): { readOnly: boolean; network: boolean; mutation: boolean; alias: boolean } {
  const rest = argv.slice(1);
  if (rest.length === 0) return { readOnly: true, network: false, mutation: false, alias: false };
  const sub = rest[0]!;
  if (sub.startsWith("-")) return { readOnly: false, network: false, mutation: true, alias: true };
  if (sub === "branch") {
    if (rest.includes("--show-current")) return { readOnly: true, network: false, mutation: false, alias: false };
    return { readOnly: false, network: false, mutation: true, alias: false };
  }
  if (READ_ONLY_GIT.has(sub)) return { readOnly: true, network: false, mutation: false, alias: false };
  if (GIT_MUTATIONS.has(sub)) {
    return { readOnly: false, network: NETWORK_GIT.has(sub), mutation: true, alias: false };
  }
  // Unknown subcommand: could be an alias that runs anything. Force ask.
  return { readOnly: false, network: false, mutation: true, alias: true };
}

function segmentAnalysis(argv: string[]): {
  readOnly: boolean;
  network: boolean;
  dynamic: boolean;
  reason: string;
} {
  if (argv.length === 0) return { readOnly: false, network: false, dynamic: false, reason: "empty segment" };
  const command = argv[0]!;
  if (command === "git") {
    const git = gitSegment(argv);
    return { readOnly: git.readOnly, network: git.network, dynamic: false, reason: git.alias ? "git alias/-c requires approval" : "git" };
  }
  if (READ_ONLY_SHELL.has(command)) return { readOnly: true, network: false, dynamic: false, reason: "read-only shell command" };
  if ((command === "rg" || command === "grep") && !argv.some((arg) => arg.includes("--pre"))) {
    return { readOnly: true, network: false, dynamic: false, reason: "read-only search" };
  }
  if (NETWORK_COMMANDS.has(command)) return { readOnly: false, network: true, dynamic: false, reason: `network command: ${command}` };
  if (["npm", "pnpm", "yarn", "bun"].includes(command)) {
    const sub = argv[1] ?? "";
    if (PACKAGE_NETWORK.has(sub)) return { readOnly: false, network: true, dynamic: false, reason: `package network operation: ${command} ${sub}` };
    if (argv.includes("--version")) return { readOnly: true, network: false, dynamic: false, reason: "version check" };
    return { readOnly: false, network: false, dynamic: false, reason: "package manager invocation" };
  }
  if (["pip", "pip3", "uv"].includes(command)) {
    return { readOnly: false, network: true, dynamic: false, reason: `python package network operation: ${command}` };
  }
  if (command === "docker" && ["push", "pull", "login"].includes(argv[1] ?? "")) {
    return { readOnly: false, network: true, dynamic: false, reason: "container registry operation" };
  }
  if (argv.includes("--version")) return { readOnly: false, network: false, dynamic: false, reason: "unknown command with --version" };
  return { readOnly: false, network: false, dynamic: false, reason: `unknown command: ${command}` };
}

export function analyzeShellCommand(command: string): ShellAnalysis {
  const { segments, dynamic, redirected } = tokenizeShell(command);
  const analyses = segments.map((seg) => ({ argv: seg, ...segmentAnalysis(seg) }));
  const network = analyses.some((a) => a.network);
  const readOnly = !dynamic && !redirected && analyses.length > 0 && analyses.every((a) => a.readOnly);
  const reasons = analyses.map((a) => a.reason);
  if (dynamic) reasons.push("dynamic command construction");
  if (redirected) reasons.push("output redirection");
  return {
    segments: segments.map((argv) => ({ argv, raw: argv.join(" "), redirected })),
    dynamic,
    redirected,
    network,
    readOnly,
    reason: reasons.join("; ") || "no segments",
  };
}

/** Denied hard in confidential mode: no path from the agent to the network. */
export function isNetworkCapableCommand(command: string): boolean {
  return analyzeShellCommand(command).network;
}
