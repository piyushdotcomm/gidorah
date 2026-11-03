/**
 * Gidorah shared contracts.
 *
 * Everything here is a type or an interface. The docs are the source of truth:
 * docs/01-architecture/data-and-events.md defines the event envelope and trace
 * record; docs/00-product/requirements.md defines the behaviors.
 */

export type Mode = "mock" | "cloud" | "confidential";
export type Phase = "explore" | "edit" | "verify" | "research" | "other";
export type ToolClass = "read" | "write" | "shell" | "git" | "research";
export type ApprovalVerdict = "allow" | "ask" | "deny";
export type RepoClass = "cloud" | "confidential";

export interface ContentBlock {
  type: "text";
  text: string;
}

export interface ToolError {
  code: string;
  message: string;
}

export interface ToolResult {
  callId: string;
  ok: boolean;
  content: ContentBlock[];
  artifactPath?: string;
  meta?: Record<string, unknown>;
  error?: ToolError;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ModelRequest {
  messages: ModelMessage[];
  modelAlias: string;
  phase: Phase;
  sessionId: string;
  confidential: boolean;
  cacheKey?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: ToolSchema[];
}

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
}

export interface ModelRef {
  provider: string;
  model: string;
}

export interface RoutingInfo {
  requested: ModelRef;
  served: ModelRef;
  fallback: boolean;
  fallbackIndex?: number;
  primary?: ModelRef;
  cacheHit: boolean;
  latencyMs: number;
}

export interface ModelResponse {
  id: string;
  content: string;
  toolCalls: ToolCall[];
  usage: TokenUsage;
  routing: RoutingInfo;
  finishReason: string;
}

export type StreamChunk =
  | { type: "delta"; text: string }
  | { type: "done"; response: ModelResponse }
  | { type: "error"; error: { code: string; message: string; retryable: boolean } };

export interface ModelClient {
  complete(request: ModelRequest, signal?: AbortSignal): Promise<ModelResponse>;
  stream(request: ModelRequest, signal?: AbortSignal): AsyncIterable<StreamChunk>;
}

// ---------------------------------------------------------------------------
// Session events (data-and-events.md §2, §3)
// ---------------------------------------------------------------------------

export type SessionEventType =
  | "session/start"
  | "session/end"
  | "session/error"
  | "turn/start"
  | "turn/end"
  | "step/start"
  | "step/end"
  | "user/message"
  | "system/message"
  | "assistant/message"
  | "assistant/attempt"
  | "tool/call"
  | "tool/result"
  | "approval/request"
  | "approval/decision"
  | "route/changed"
  | "budget/updated"
  | "budget/task"
  | "research/request"
  | "research/result"
  | "research/denied"
  | "docs/check"
  | "dlp/blocked"
  | "context/metrics"
  | "audit/anchor"
  | "redteam/result"
  | "compaction/summary";

export interface SessionEvent<T = unknown> {
  seq: number;
  time: number;
  type: SessionEventType;
  data: T;
  schemaVersion: 1;
  prevHash: string;
  hash: string;
  chainVersion: 1;
}

export interface SessionHeader {
  sessionId: string;
  cwd: string;
  user: string;
  policyVersion: string;
  mode: Mode;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Policy (data-and-events.md §7)
// ---------------------------------------------------------------------------

export interface Policy {
  version: number;
  user: string;
  mode: {
    default: Mode;
    confidential: { paths: string[]; remotes: string[]; marker: string };
  };
  budgets: {
    llm: { virtual_key_cloud: string; virtual_key_local: string; soft_threshold: number; at_limit: "local_first" | "stop" };
    research: { credits_per_day: number; calls_per_task: number };
    task: { default_usd: number; on_limit: "ask" | "stop" };
  };
  research: { enabled: boolean; official_domains: Record<string, string[]>; ttl_seconds: number; card_token_cap: number };
  docsGuard: { enabled: boolean; max_lookups_per_edit: number; advisory_only: boolean };
  context: { tool_cap_tokens: number; clear_after_tool_results: number; compact_at_pressure: number; compaction: "off" | "pressure" | "measured" };
  editing: { patch_first: boolean; require_reason_for_full_write: boolean };
  repoMap: { enabled: boolean; max_tokens: number };
  audit: { enabled: boolean; anchor_path: string; sign_head: boolean };
  redteam: { enabled: boolean; corpus: string; canary_required: boolean };
  dlp: { enabled: boolean; default_action: "block" | "redact"; allowlist: string[] };
  approvals: {
    reads: ApprovalVerdict;
    writes: ApprovalVerdict;
    shell: ApprovalVerdict;
    git_read: ApprovalVerdict;
    git_write: ApprovalVerdict;
    confidential_network: ApprovalVerdict;
  };
  providers: { aliases: Record<string, string>; cloud: string[]; local: string[] };
}

// ---------------------------------------------------------------------------
// Tavily evidence (tavily-knowledge-plane.md §6)
// ---------------------------------------------------------------------------

export interface EvidenceSource {
  title: string;
  url: string;
  domain: string;
  retrievedAt: string;
}

export interface EvidenceCard {
  id: string;
  question: string;
  answer: string;
  facts: string[];
  sources: EvidenceSource[];
  confidence: "high" | "medium" | "low";
  package?: { name: string; version: string };
  tokenEstimate: number;
  cached: boolean;
}

export interface ResearchQuery {
  question: string;
  packageName?: string;
  packageVersion?: string;
  errorText?: string;
  language?: string;
  officialDomains?: string[];
  taskId: string;
}

export type ResearchOutcome =
  | { status: "card"; card: EvidenceCard; credits: number; cached: boolean }
  | { status: "local_answer"; reason: string }
  | { status: "denied"; reason: string }
  | { status: "budget_exhausted"; reason: string }
  | { status: "unavailable"; reason: string };

export interface ResearchClient {
  research(query: ResearchQuery, options: { confidential: boolean; cachedOnly?: boolean }): Promise<ResearchOutcome>;
}

// ---------------------------------------------------------------------------
// Flight recorder (observability-and-release.md, data-and-events.md §8)
// ---------------------------------------------------------------------------

export interface TraceRecord {
  requestId: string;
  sessionId: string;
  taskId: string;
  phase: Phase;
  requested: ModelRef;
  served: ModelRef;
  fallback: boolean;
  fallbackIndex?: number;
  cacheHit: boolean;
  tokens: { input: number; cacheRead: number; cacheWrite: number; output: number; total: number };
  costUsd: number;
  latencyMs: number;
  research?: { queryHash: string; credits: number; sources: number; cardTokens: number; cached: boolean } | null;
  dlp?: { action: "clean" | "blocked"; class?: string; hash?: string } | null;
  docsGuard?: { result: "verified" | "unknown" | "deprecated" | "skipped"; symbols?: string[] } | null;
  context?: { prefixHash: string; capTokens: number; cleared: number; compactionNetCostUsd?: number } | null;
  budgetAfter?: { llmUsd: number; researchCredits: number; taskUsd?: number };
}

export interface Receipt {
  sessionId: string;
  taskId: string;
  status: "success" | "failed" | "denied" | "budget_exhausted" | "provider_error";
  summary: string;
  tokens: TokenUsage;
  llmCostUsd: number;
  researchCredits: number;
  fallbacks: number;
  budgetRemaining: { llmUsd: number; researchCredits: number };
  tracePath?: string;
}

// ---------------------------------------------------------------------------
// TUI events (tui-adaptation.md §3)
// ---------------------------------------------------------------------------

export type TuiEvent =
  | { type: "assistant_delta"; text: string }
  | { type: "assistant_done"; messageId: string }
  | { type: "tool_call"; callId: string; name: string; args: unknown }
  | { type: "tool_result"; callId: string; ok: boolean; summary: string; artifact?: string }
  | { type: "approval_request"; approvalId: string; tool: string; risk: string; preview: string }
  | { type: "approval_decision"; approvalId: string; decision: "allow" | "deny" }
  | { type: "route_changed"; from: string; to: string; reason: string; fallbackIndex?: number }
  | { type: "budget_updated"; llmUsd: number; llmLimit: number; researchCredits: number; researchLimit: number }
  | { type: "research_card"; card: EvidenceCard }
  | { type: "dlp_blocked"; class: string; action: "blocked" | "redacted" }
  | { type: "docs_check"; result: "verified" | "unknown" | "deprecated" | "skipped"; symbols?: string[] }
  | { type: "notice"; level: "info" | "warn" | "error"; text: string }
  | { type: "turn_done"; receipt: Receipt };

// ---------------------------------------------------------------------------
// Benchmark (benchmark-plan.md)
// ---------------------------------------------------------------------------

export type TaskClass = "A" | "B" | "S";
export type ArmId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J";

export interface TaskSpec {
  id: string;
  class: TaskClass;
  name: string;
  goal: string;
  files: string[];
  fixture: string;
  allowedResearch: number;
  timeCapMs: number;
  tokenCap: number;
  taskBudgetUsd: number;
  /** Scripted mock-model plan used offline (real providers attach real turns). */
  mockPlan: { edits: Array<{ path: string; find: string; replace: string }>; testCommand: string };
}

export interface ArmSpec {
  id: ArmId;
  name: string;
  modelAlias: string;
  fullHistory: boolean;
  capToolOutput: boolean;
  clearOldResults: boolean;
  compacts: boolean;
  research: boolean;
  patchFirst: boolean;
  repoMap: boolean;
  description: string;
}

export interface TaskResult {
  taskId: string;
  armId: ArmId;
  class: TaskClass;
  run: number;
  passed: boolean;
  status: "evaluated" | "missing" | "errored" | "skipped";
  tokens: TokenUsage;
  costUsd: number;
  researchCredits: number;
  researchCalls: number;
  unnecessaryResearch: boolean;
  modelRequests: number;
  toolCalls: number;
  patchTokens: number;
  fullFileReads: number;
  fallbacks: number;
  approvalPrompts: number;
  cacheHit: boolean;
  wallMs: number;
  failureCategory?: string;
}
