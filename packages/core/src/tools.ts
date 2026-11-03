/**
 * Tool plane (agent-runtime.md §2).
 *
 * Every tool returns a structured ToolResult and never throws across the tool
 * boundary. Read-only tools run without approval; the runtime runs the approval
 * classifier before any mutating tool executes. Command execution captures
 * output through files instead of pipes because the sandbox denies piped child
 * stdio (see ADR-0013).
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, openSync, closeSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { redactSecrets } from "../../shared/src/redaction.ts";
import type { ContentBlock, ResearchClient, ToolResult, ToolSchema } from "../../shared/src/types.ts";

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface RunOptions {
  command: string;
  args: string[];
  cwd: string;
  shell?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Run a process with stdout/stderr redirected to temp files. Piped stdio is
 * denied by the sandbox, so this is the portable capture strategy.
 */
export async function runProcess(options: RunOptions): Promise<CommandResult> {
  const token = randomUUID();
  const outPath = join(tmpdir(), `gidorah-${token}.out`);
  const errPath = join(tmpdir(), `gidorah-${token}.err`);
  const outFd = openSync(outPath, "w");
  const errFd = openSync(errPath, "w");
  const timeoutMs = options.timeoutMs ?? 60_000;

  return new Promise<CommandResult>((resolvePromise) => {
    let settled = false;
    const finish = (result: CommandResult): void => {
      if (settled) return;
      settled = true;
      closeSync(outFd);
      closeSync(errFd);
      let stdout = "";
      let stderr = "";
      try {
        stdout = readFileSync(outPath, "utf8");
        stderr = readFileSync(errPath, "utf8");
      } catch {
        // capture failure leaves empty output
      }
      try {
        unlinkSync(outPath);
        unlinkSync(errPath);
      } catch {
        // best effort cleanup
      }
      resolvePromise({ ...result, stdout, stderr });
    };

    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      shell: options.shell ?? false,
      stdio: ["ignore", outFd, errFd],
      windowsHide: true,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ code: 124, stdout: "", stderr: "command timed out", timedOut: true });
    }, timeoutMs);
    child.on("error", (error: Error) => {
      clearTimeout(timer);
      finish({ code: 127, stdout: "", stderr: error.message, timedOut: false });
    });
    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      finish({ code: code ?? 1, stdout: "", stderr: "", timedOut: false });
    });
  });
}

export interface ToolContext {
  cwd: string;
  workspaceRoot: string;
  sessionId: string;
  callId: string;
  confidential: boolean;
  artifactsDir?: string;
  research?: ResearchClient;
  run: (options: RunOptions) => Promise<CommandResult>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  names(): string[] {
    return [...this.tools.keys()].sort();
  }

  /** JSON schemas advertised to a real model so it can call these tools. */
  schemas(): ToolSchema[] {
    const specs: Record<string, { properties: Record<string, unknown>; required: string[] }> = {
      read: { properties: { path: { type: "string" }, start: { type: "number" }, end: { type: "number" } }, required: ["path"] },
      repo_map: { properties: { path: { type: "string" } }, required: [] },
      glob: { properties: { pattern: { type: "string" } }, required: ["pattern"] },
      grep: { properties: { pattern: { type: "string" }, path: { type: "string" } }, required: ["pattern"] },
      list: { properties: { path: { type: "string" } }, required: [] },
      write: { properties: { path: { type: "string" }, content: { type: "string" }, reason: { type: "string" } }, required: ["path", "content"] },
      edit: { properties: { path: { type: "string" }, find: { type: "string" }, replace: { type: "string" } }, required: ["path", "find", "replace"] },
      bash: { properties: { command: { type: "string" }, cwd: { type: "string" } }, required: ["command"] },
      git: { properties: { subcommand: { type: "string" }, args: { type: "array", items: { type: "string" } } }, required: ["subcommand"] },
      research: { properties: { question: { type: "string" }, packageName: { type: "string" }, packageVersion: { type: "string" }, errorText: { type: "string" } }, required: ["question"] },
    };
    return [...this.tools.values()].map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: { type: "object", properties: specs[tool.name]?.properties ?? {}, required: specs[tool.name]?.required ?? [] },
      },
    }));
  }
}

export class ToolFailure extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function ok(ctx: ToolContext, content: ContentBlock[], meta?: Record<string, unknown>): ToolResult {
  return { callId: ctx.callId, ok: true, content, ...(meta === undefined ? {} : { meta }) };
}

function fail(ctx: ToolContext, code: string, message: string): ToolResult {
  return { callId: ctx.callId, ok: false, content: [{ type: "text", text: message }], error: { code, message } };
}

function resolveInside(root: string, target: string, cwd: string): string {
  const resolved = resolve(cwd, target);
  const rel = relative(resolve(root), resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new ToolFailure("PATH_ESCAPE", `path escapes the workspace: ${target}`);
  return resolved;
}

function cap(text: string, tokens: number, maxLines = 400): string {
  const lines = text.split("\n");
  const bounded = lines.length > maxLines ? [...lines.slice(0, maxLines), `[truncated ${lines.length - maxLines} lines]`] : lines;
  let out = bounded.join("\n");
  if (Math.ceil(out.length / 4) > tokens) out = `${out.slice(0, tokens * 4)}\n[truncated at ${tokens} tokens]`;
  return out;
}

function walkFiles(root: string, limit = 2000): string[] {
  const out: string[] = [];
  const skip = new Set([".git", "node_modules", ".gidorah", "dist", "coverage", "artifacts", ".pnpm-store"]);
  const visit = (dir: string): void => {
    if (out.length >= limit) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= limit) return;
      if (skip.has(entry)) continue;
      const full = join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) visit(full);
      else if (stat.isFile()) out.push(full);
    }
  };
  visit(root);
  return out;
}

function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replaceAll("\\", "/");
  const escaped = normalized
    .split("**")
    .map((part) =>
      part
        .split("*")
        .map((piece) => piece.replace(/[.+^${}()|[\]\\]/g, "\\$&"))
        .join("[^/]*"),
    )
    .join(".*");
  return new RegExp(`^${escaped}$`);
}

export function createDefaultTools(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    name: "read",
    description: "Read a file by line range or symbol. Ordinary reads are free.",
    async run(args, ctx) {
      const path = typeof args.path === "string" ? args.path : "";
      if (path === "") return fail(ctx, "INVALID_ARGS", "read requires a path");
      const resolved = resolveInside(ctx.workspaceRoot, path, ctx.cwd);
      if (!existsSync(resolved)) return fail(ctx, "NOT_FOUND", `file not found: ${path}`);
      const text = readFileSync(resolved, "utf8");
      const lines = text.split("\n");
      const start = typeof args.start === "number" ? Math.max(1, args.start) : 1;
      const end = typeof args.end === "number" ? Math.min(lines.length, args.end) : Math.min(lines.length, start + 399);
      const selected = lines.slice(start - 1, end);
      const numbered = selected.map((line, index) => `${start + index}: ${line}`).join("\n");
      return ok(ctx, [{ type: "text", text: cap(numbered, 4000) }], { path: relative(ctx.workspaceRoot, resolved), lines: selected.length });
    },
  });

  registry.register({
    name: "repo_map",
    description: "Bounded outline of files and exported symbols. No file bodies.",
    async run(args, ctx) {
      const root = args.path === undefined ? ctx.cwd : resolveInside(ctx.workspaceRoot, String(args.path), ctx.cwd);
      const files = walkFiles(root, 800).filter((file) => /\.(ts|tsx|js|jsx|mjs|py|go|rs|java)$/.test(file));
      const outline: string[] = [];
      for (const file of files) {
        let content = "";
        try {
          content = readFileSync(file, "utf8");
        } catch {
          continue;
        }
        const symbols: string[] = [];
        const regex = /^\s*(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const|let|def|func)\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
        let match = regex.exec(content);
        while (match !== null) {
          if (match[1] !== undefined) symbols.push(match[1]);
          match = regex.exec(content);
        }
        if (symbols.length > 0) outline.push(`${relative(ctx.workspaceRoot, file).replaceAll("\\", "/")}: ${[...new Set(symbols)].slice(0, 12).join(", ")}`);
        if (outline.length >= 200) break;
      }
      return ok(ctx, [{ type: "text", text: cap(outline.join("\n"), 2000) }], { files: files.length });
    },
  });

  registry.register({
    name: "glob",
    description: "Find files by glob pattern, respecting the default ignore list.",
    async run(args, ctx) {
      const pattern = typeof args.pattern === "string" ? args.pattern : "";
      if (pattern === "") return fail(ctx, "INVALID_ARGS", "glob requires a pattern");
      const regex = globToRegExp(pattern);
      const files = walkFiles(ctx.cwd).filter((file) => regex.test(relative(ctx.workspaceRoot, file).replaceAll("\\", "/")));
      return ok(ctx, [{ type: "text", text: files.slice(0, 200).map((file) => relative(ctx.workspaceRoot, file).replaceAll("\\", "/")).join("\n") }], { count: files.length });
    },
  });

  registry.register({
    name: "grep",
    description: "Search file contents with a regular expression.",
    async run(args, ctx) {
      const pattern = typeof args.pattern === "string" ? args.pattern : "";
      if (pattern === "") return fail(ctx, "INVALID_ARGS", "grep requires a pattern");
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, "i");
      } catch {
        return fail(ctx, "INVALID_REGEX", `invalid regular expression: ${pattern}`);
      }
      const root = args.path === undefined ? ctx.cwd : resolveInside(ctx.workspaceRoot, String(args.path), ctx.cwd);
      const files = walkFiles(root, 1200).filter((file) => !/\.(png|jpg|jpeg|gif|ico|pdf|zip|exe|dll)$/i.test(file));
      const matches: string[] = [];
      for (const file of files) {
        let content = "";
        try {
          content = readFileSync(file, "utf8");
        } catch {
          continue;
        }
        content.split("\n").forEach((line, index) => {
          if (matches.length >= 200) return;
          if (regex.test(line)) matches.push(`${relative(ctx.workspaceRoot, file).replaceAll("\\", "/")}:${index + 1}: ${line.slice(0, 200)}`);
        });
        if (matches.length >= 200) break;
      }
      return ok(ctx, [{ type: "text", text: matches.join("\n") }], { matches: matches.length });
    },
  });

  registry.register({
    name: "list",
    description: "List a directory.",
    async run(args, ctx) {
      const target = args.path === undefined ? ctx.cwd : resolveInside(ctx.workspaceRoot, String(args.path), ctx.cwd);
      if (!existsSync(target)) return fail(ctx, "NOT_FOUND", `directory not found: ${String(args.path)}`);
      const entries = readdirSync(target).map((entry) => {
        try {
          return statSync(join(target, entry)).isDirectory() ? `${entry}/` : entry;
        } catch {
          return entry;
        }
      });
      return ok(ctx, [{ type: "text", text: entries.join("\n") }], { count: entries.length });
    },
  });

  registry.register({
    name: "write",
    description: "Create or replace a file. Requires approval and a stated reason for full rewrites.",
    async run(args, ctx) {
      const path = typeof args.path === "string" ? args.path : "";
      const content = typeof args.content === "string" ? args.content : "";
      if (path === "") return fail(ctx, "INVALID_ARGS", "write requires a path");
      const resolved = resolveInside(ctx.workspaceRoot, path, ctx.cwd);
      const existed = existsSync(resolved);
      const reason = typeof args.reason === "string" ? args.reason : "";
      if (existed && reason.trim() === "") return fail(ctx, "REASON_REQUIRED", "full-file rewrite requires a reason; prefer edit with a find/replace patch");
      mkdirSync(dirname(resolved), { recursive: true });
      writeFileSync(resolved, content, "utf8");
      return ok(ctx, [{ type: "text", text: `${existed ? "rewrote" : "created"} ${relative(ctx.workspaceRoot, resolved).replaceAll("\\", "/")} (${content.length} bytes)` }], {
        bytes: content.length,
        fullWrite: true,
      });
    },
  });

  registry.register({
    name: "edit",
    description: "Apply a unique find/replace patch. Ambiguous or missing matches fail.",
    async run(args, ctx) {
      const path = typeof args.path === "string" ? args.path : "";
      const find = typeof args.find === "string" ? args.find : "";
      const replace = typeof args.replace === "string" ? args.replace : "";
      if (path === "" || find === "") return fail(ctx, "INVALID_ARGS", "edit requires path and find");
      const resolved = resolveInside(ctx.workspaceRoot, path, ctx.cwd);
      if (!existsSync(resolved)) return fail(ctx, "NOT_FOUND", `file not found: ${path}`);
      const content = readFileSync(resolved, "utf8");
      const occurrences = content.split(find).length - 1;
      if (occurrences === 0) return fail(ctx, "NO_MATCH", "find block does not occur in the file");
      if (occurrences > 1) return fail(ctx, "AMBIGUOUS_MATCH", `find block occurs ${occurrences} times; provide a more specific block`);
      writeFileSync(resolved, content.replace(find, replace), "utf8");
      return ok(ctx, [{ type: "text", text: `patched ${relative(ctx.workspaceRoot, resolved).replaceAll("\\", "/")} (${find.length} -> ${replace.length} chars)` }], {
        patch: true,
        findLength: find.length,
        replaceLength: replace.length,
      });
    },
  });

  registry.register({
    name: "bash",
    description: "Run a shell command in the workspace. Requires approval except for read-only allowlisted commands.",
    async run(args, ctx) {
      const command = typeof args.command === "string" ? args.command : "";
      if (command === "") return fail(ctx, "INVALID_ARGS", "bash requires a command");
      const cwd = args.cwd === undefined ? ctx.cwd : resolveInside(ctx.workspaceRoot, String(args.cwd), ctx.cwd);
      const result = await ctx.run({ command, args: [], cwd, shell: true });
      const text = [
        result.stdout.trim(),
        result.stderr.trim() === "" ? "" : `stderr:\n${result.stderr.trim()}`,
        result.timedOut ? "[timed out]" : "",
      ]
        .filter((part) => part !== "")
        .join("\n");
      const redacted = redactSecrets(text).text;
      if (result.code !== 0) {
        return {
          callId: ctx.callId,
          ok: false,
          content: [{ type: "text", text: cap(redacted, 4000) }],
          error: { code: "COMMAND_FAILED", message: `command exited with code ${result.code}` },
          meta: { exitCode: result.code },
        };
      }
      return ok(ctx, [{ type: "text", text: cap(redacted, 4000) }], { exitCode: 0 });
    },
  });

  registry.register({
    name: "git",
    description: "Run a git subcommand. Reads may auto-allow; mutations require approval.",
    async run(args, ctx) {
      const subcommand = typeof args.subcommand === "string" ? args.subcommand : "";
      if (subcommand === "") return fail(ctx, "INVALID_ARGS", "git requires a subcommand");
      const extra = Array.isArray(args.args) ? (args.args as unknown[]).map(String) : [];
      const result = await ctx.run({ command: "git", args: [subcommand, ...extra], cwd: ctx.cwd });
      const text = [result.stdout.trim(), result.stderr.trim()].filter((part) => part !== "").join("\n");
      return {
        callId: ctx.callId,
        ok: result.code === 0,
        content: [{ type: "text", text: cap(redactSecrets(text).text, 2000) }],
        ...(result.code === 0 ? {} : { error: { code: "GIT_FAILED", message: `git exited with code ${result.code}` } }),
      };
    },
  });

  registry.register({
    name: "research",
    description: "Ask Tavily for current, cited documentation. Disabled in confidential mode.",
    async run(args, ctx) {
      if (ctx.confidential) return fail(ctx, "RESEARCH_DENIED", "research unavailable in confidential mode");
      if (ctx.research === undefined) return fail(ctx, "RESEARCH_UNAVAILABLE", "no research client configured");
      const question = typeof args.question === "string" ? args.question : "";
      if (question === "") return fail(ctx, "INVALID_ARGS", "research requires a question");
      const outcome = await ctx.research.research(
        {
          question,
          ...(typeof args.packageName === "string" ? { packageName: args.packageName } : {}),
          ...(typeof args.packageVersion === "string" ? { packageVersion: args.packageVersion } : {}),
          ...(typeof args.errorText === "string" ? { errorText: args.errorText } : {}),
          taskId: ctx.sessionId,
        },
        { confidential: ctx.confidential },
      );
      if (outcome.status !== "card") {
        return fail(ctx, outcome.status.toUpperCase(), outcome.reason);
      }
      const card = outcome.card;
      const text = [
        `RESEARCH CARD (${card.tokenEstimate} tokens, ${card.confidence} confidence, ${card.cached ? "cached" : "fresh"})`,
        `Question: ${card.question}`,
        `Answer: ${card.answer}`,
        "Facts:",
        ...card.facts.map((fact) => `- ${fact}`),
        "Sources:",
        ...card.sources.map((source, index) => `[${index + 1}] ${source.url} (${source.domain})`),
      ].join("\n");
      return ok(ctx, [{ type: "text", text: cap(text, 900) }], { credits: outcome.credits, cached: outcome.cached });
    },
  });

  return registry;
}
