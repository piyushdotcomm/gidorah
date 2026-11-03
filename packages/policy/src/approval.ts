/**
 * Approval classifier (agent-runtime.md §3).
 *
 * Reads are free. Writes, shell, and git ask. Denials are honored: the gate
 * never executes a denied call regardless of what the model says. Confidential
 * mode turns network-capable commands from "ask" into hard denial.
 */
import { isAbsolute, relative, resolve } from "node:path";
import type { ApprovalVerdict, Policy, ToolClass } from "../../shared/src/types.ts";
import type { Classification } from "./classify.ts";
import { analyzeShellCommand } from "./shell.ts";

export interface ApprovalContext {
  policy: Policy;
  classification: Classification;
  cwd: string;
  workspaceRoot: string;
}

export interface ApprovalDecision {
  verdict: ApprovalVerdict;
  toolClass: ToolClass;
  risk: string;
  reason: string;
  preview: string;
}

const TOOL_CLASS: Record<string, ToolClass> = {
  read: "read",
  repo_map: "read",
  glob: "read",
  grep: "read",
  list: "read",
  research: "research",
  write: "write",
  edit: "write",
  apply_patch: "write",
  bash: "shell",
  git: "git",
};

const PROTECTED_PATTERNS = [/\.ssh[\\/]/, /\.aws[\\/]/, /id_rsa/, /id_ed25519/, /\.netrc/, /credentials\.json/, /\.git-credentials/];

function isInsideRoot(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  // The workspace root itself is inside the workspace (list ., repo_map ., etc.).
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function targetPath(args: Record<string, unknown>): string | null {
  const value = args.path ?? args.file ?? args.target;
  return typeof value === "string" ? value : null;
}

export function classifyToolCall(tool: string, args: Record<string, unknown>, ctx: ApprovalContext): ApprovalDecision {
  const toolClass = TOOL_CLASS[tool] ?? "write";
  const toolPolicy = ctx.policy;

  if (toolClass === "research") {
    if (ctx.classification.mode === "confidential") {
      return { verdict: "deny", toolClass, risk: "confidential-research", reason: "research disabled in confidential mode", preview: "research (blocked)" };
    }
    if (!toolPolicy.research.enabled) {
      return { verdict: "deny", toolClass, risk: "research-disabled", reason: "research disabled by policy", preview: "research (blocked)" };
    }
    return { verdict: toolPolicy.approvals.reads, toolClass, risk: "read-external", reason: "policy-gated, budgeted research", preview: "research call" };
  }

  const path = targetPath(args);
  if (path !== null && (toolClass === "write" || toolClass === "read")) {
    const resolved = resolve(ctx.cwd, path);
    if (PROTECTED_PATTERNS.some((re) => re.test(resolved))) {
      return { verdict: "deny", toolClass, risk: "protected-path", reason: "path matches a credential store", preview: resolved };
    }
    if (!isInsideRoot(ctx.workspaceRoot, resolved) && !isInsideRoot(ctx.workspaceRoot, `${resolved}`)) {
      return { verdict: "deny", toolClass, risk: "path-escape", reason: "path is outside the workspace root", preview: resolved };
    }
    const preview = toolClass === "write" ? `write ${resolved}` : `read ${resolved}`;
    if (toolClass === "read") {
      return { verdict: toolPolicy.approvals.reads, toolClass, risk: "read", reason: "ordinary read", preview };
    }
    return { verdict: toolPolicy.approvals.writes, toolClass, risk: "write", reason: "write requires approval with a diff preview", preview };
  }

  if (toolClass === "shell") {
    const command = typeof args.command === "string" ? args.command : typeof args.cmd === "string" ? args.cmd : "";
    const analysis = analyzeShellCommand(command);
    if (ctx.classification.mode === "confidential" && analysis.network) {
      return {
        verdict: toolPolicy.approvals.confidential_network,
        toolClass,
        risk: "confidential-network",
        reason: `network-capable command denied in confidential mode: ${analysis.reason}`,
        preview: command,
      };
    }
    if (analysis.readOnly) {
      return { verdict: "allow", toolClass, risk: "read-only-shell", reason: `read-only allowlist: ${analysis.reason}`, preview: command };
    }
    if (analysis.dynamic) {
      return { verdict: "ask", toolClass, risk: "dynamic-shell", reason: "dynamic command construction forces approval", preview: command };
    }
    return { verdict: toolPolicy.approvals.shell, toolClass, risk: analysis.network ? "network-shell" : "shell", reason: analysis.reason, preview: command };
  }

  if (toolClass === "git") {
    const sub = typeof args.subcommand === "string" ? args.subcommand : typeof args.command === "string" ? args.command : "";
    const extra = Array.isArray(args.args) ? (args.args as unknown[]).map(String) : [];
    const analysis = analyzeShellCommand(["git", sub, ...extra].join(" "));
    const readOnly = sub !== "" && analysis.readOnly && ["status", "diff", "log", "show", "rev-parse", "ls-files", "branch"].includes(sub);
    if (analysis.network && ctx.classification.mode === "confidential") {
      return { verdict: "deny", toolClass, risk: "confidential-git-network", reason: "network git operation denied in confidential mode", preview: `git ${sub}` };
    }
    if (readOnly) {
      return { verdict: toolPolicy.approvals.git_read, toolClass, risk: "git-read", reason: "read-only git subcommand", preview: `git ${sub}` };
    }
    return { verdict: toolPolicy.approvals.git_write, toolClass, risk: "git-mutation", reason: "git mutation requires approval", preview: `git ${sub}` };
  }

  if (toolClass === "read") {
    return { verdict: toolPolicy.approvals.reads, toolClass, risk: "read", reason: "ordinary read", preview: tool };
  }
  return { verdict: "ask", toolClass: "write", risk: "unknown-tool", reason: `unknown tool: ${tool}`, preview: tool };
}
