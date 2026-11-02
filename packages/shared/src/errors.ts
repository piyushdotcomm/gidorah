/**
 * Structured errors. Expected failures are values, not exceptions thrown across
 * a tool boundary: tools always return ToolResult. These error classes are for
 * control-flow boundaries (model client, policy, budget) and map to the CLI
 * exit codes in docs/02-engineering/cli-contract.md.
 */

export type ErrorCode =
  | "BUDGET_EXCEEDED"
  | "PROVIDER_ERROR"
  | "POLICY_DENIED"
  | "RESEARCH_DENIED"
  | "RESEARCH_BUDGET_EXHAUSTED"
  | "RESEARCH_UNAVAILABLE"
  | "NO_RESULTS"
  | "LOCAL_ANSWER_FOUND"
  | "APPROVAL_DENIED"
  | "CONFIG_ERROR"
  | "TOOL_ERROR"
  | "AUDIT_TAMPERED"
  | "INTERNAL_ERROR";

export class GidorahError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly details: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, options: { retryable?: boolean; details?: Record<string, unknown>; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.details = options.details ?? {};
  }
}

export class BudgetExceededError extends GidorahError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("BUDGET_EXCEEDED", message, { retryable: false, details });
  }
}

export class ProviderError extends GidorahError {
  readonly status: number;
  constructor(message: string, options: { status?: number; retryable?: boolean; details?: Record<string, unknown> } = {}) {
    super("PROVIDER_ERROR", message, {
      retryable: options.retryable ?? false,
      details: { ...options.details, status: options.status ?? 0 },
    });
    this.status = options.status ?? 0;
  }
}

export class PolicyDeniedError extends GidorahError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("POLICY_DENIED", message, { retryable: false, details });
  }
}

export class ApprovalDeniedError extends GidorahError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("APPROVAL_DENIED", message, { retryable: false, details });
  }
}

export class ResearchDeniedError extends GidorahError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("RESEARCH_DENIED", message, { retryable: false, details });
  }
}

export class ConfigError extends GidorahError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("CONFIG_ERROR", message, { retryable: false, details });
  }
}

export class AuditError extends GidorahError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("AUDIT_TAMPERED", message, { retryable: false, details });
  }
}

export function toErrorPayload(error: unknown): { code: string; message: string; retryable: boolean; requestId?: string } {
  if (error instanceof GidorahError) {
    return { code: error.code, message: error.message, retryable: error.retryable };
  }
  if (error instanceof Error) {
    return { code: "INTERNAL_ERROR", message: error.message, retryable: false };
  }
  return { code: "INTERNAL_ERROR", message: String(error), retryable: false };
}
