/**
 * Docs Guard (tavily-knowledge-plane.md Â§7, ADR-0008).
 *
 * After an edit that touches external APIs, verify the changed symbols against
 * a cached fact sheet for the pinned package version. A fresh sheet can be
 * trusted without any research call; an unknown or deprecated symbol triggers
 * at most one targeted lookup and is then treated as an assumption. Docs Guard
 * never blocks tests and never runs for repo-local changes or in confidential
 * mode.
 */
import type { ResearchClient } from "../../shared/src/types.ts";

export interface ApiSymbol {
  name: string;
  kind: "function" | "class" | "method" | "type" | "constant";
  deprecated?: boolean;
  signature?: string;
  source: string;
}

export interface ApiFactSheet {
  package: string;
  version: string;
  symbols: ApiSymbol[];
  retrievedAt: string;
  confidence: "high" | "medium" | "low";
}

export type DocsGuardResult = "verified" | "unknown" | "deprecated" | "skipped";

export interface DocsGuardOutcome {
  result: DocsGuardResult;
  symbols: string[];
  lookups: number;
  advisory: string;
}

export interface DocsGuardOptions {
  factSheets: Map<string, ApiFactSheet>;
  research?: ResearchClient;
  maxLookupsPerEdit?: number;
  confidential?: boolean;
}

function sheetKey(pkg: string, version: string): string {
  return `${pkg}@${version}`;
}

export function registerFactSheet(sheets: Map<string, ApiFactSheet>, sheet: ApiFactSheet): void {
  sheets.set(sheetKey(sheet.package, sheet.version), sheet);
}

export interface DocsGuardCheck {
  file: string;
  packageName?: string;
  packageVersion?: string;
  changedSymbols: string[];
  repoLocalOnly: boolean;
}

export async function checkDocsGuard(check: DocsGuardCheck, options: DocsGuardOptions): Promise<DocsGuardOutcome> {
  const symbols = [...new Set(check.changedSymbols)];
  if (options.confidential === true) {
    return { result: "skipped", symbols, lookups: 0, advisory: "docs guard disabled in confidential mode" };
  }
  if (check.repoLocalOnly || check.packageName === undefined || check.packageVersion === undefined) {
    return { result: "skipped", symbols, lookups: 0, advisory: "repo-local change; no external docs lookup" };
  }

  const key = sheetKey(check.packageName, check.packageVersion);
  const sheet = options.factSheets.get(key);
  if (sheet !== undefined) {
    const known = sheet.symbols.map((symbol) => symbol.name);
    const deprecated = sheet.symbols.filter((symbol) => symbol.deprecated === true).map((symbol) => symbol.name);
    if (symbols.length > 0 && symbols.every((symbol) => known.includes(symbol) && !deprecated.includes(symbol))) {
      return { result: "verified", symbols, lookups: 0, advisory: `verified against cached fact sheet ${key}` };
    }
    if (deprecated.some((symbol) => symbols.includes(symbol))) {
      return { result: "deprecated", symbols, lookups: 0, advisory: `deprecated symbol for ${key}; treat as assumption` };
    }
  }

  // Unknown or missing fact sheet: at most one targeted lookup, advisory only.
  const maxLookups = options.maxLookupsPerEdit ?? 1;
  if (options.research === undefined || maxLookups <= 0) {
    return { result: "unknown", symbols, lookups: 0, advisory: "no research client; symbol is an assumption, not a fact" };
  }
  const outcome = await options.research.research(
    {
      question: `Does ${symbols.join(", ")} exist in ${check.packageName} ${check.packageVersion}?`,
      packageName: check.packageName,
      packageVersion: check.packageVersion,
      taskId: `docsguard:${check.file}`,
    },
    { confidential: false },
  );
  if (outcome.status !== "card") {
    return { result: "unknown", symbols, lookups: 0, advisory: "lookup unavailable; symbol is an assumption" };
  }
  return {
    result: "unknown",
    symbols,
    lookups: 1,
    advisory: `one targeted lookup performed; confidence ${outcome.card.confidence}; still an assumption, not a fact`,
  };
}
