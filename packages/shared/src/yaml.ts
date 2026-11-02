/**
 * Minimal YAML subset parser for policy files.
 *
 * The docs define `~/.gidorah/policy.yml` as the root of trust. A full YAML
 * library is not installable offline, so this parser supports exactly the
 * subset the policy schema uses: nested mappings by indentation, scalar lists,
 * comments, quoted and plain scalars. It fails loudly on anything else rather
 * than guessing. ADR-0013 records the substitution.
 */

interface Line {
  indent: number;
  text: string;
}

function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quote !== null) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "#" && (i === 0 || line[i - 1] === " ")) return line.slice(0, i).trimEnd();
  }
  return line.trimEnd();
}

function parseScalar(raw: string): unknown {
  const text = raw.trim();
  if (text === "") return null;
  if (text === "[]") return [];
  if (text === "{}") return {};
  if (text === "true") return true;
  if (text === "false") return false;
  if (text === "null" || text === "~") return null;
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  if (/^-?\d+$/.test(text)) return Number.parseInt(text, 10);
  if (/^-?\d*\.\d+$/.test(text)) return Number.parseFloat(text);
  return text;
}

class YamlError extends Error {}

function parseBlock(lines: Line[], start: number, indent: number): { value: unknown; next: number } {
  if (start >= lines.length) return { value: null, next: start };
  if (lines[start]!.text.startsWith("- ")) return parseSequence(lines, start, indent);
  return parseMapping(lines, start, indent);
}

function parseSequence(lines: Line[], start: number, indent: number): { value: unknown[]; next: number } {
  const out: unknown[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.indent !== indent || !line.text.startsWith("- ")) break;
    const item = line.text.slice(2).trim();
    if (item.includes(": ")) throw new YamlError(`Unsupported YAML list-of-maps at line ${index + 1}: ${line.text}`);
    out.push(parseScalar(item));
    index += 1;
  }
  return { value: out, next: index };
}

function parseMapping(lines: Line[], start: number, indent: number): { value: Record<string, unknown>; next: number } {
  const out: Record<string, unknown> = {};
  let index = start;
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.indent !== indent) break;
    if (line.text.startsWith("- ")) break;
    const colon = line.text.indexOf(":");
    if (colon === -1) throw new YamlError(`Expected "key: value" at line ${index + 1}: ${line.text}`);
    const key = line.text.slice(0, colon).trim();
    const rest = line.text.slice(colon + 1).trim();
    if (key === "") throw new YamlError(`Empty key at line ${index + 1}`);
    index += 1;
    if (rest !== "") {
      out[key] = parseScalar(rest);
      continue;
    }
    const nextLine = lines[index];
    if (nextLine !== undefined && nextLine.indent > indent) {
      const child = parseBlock(lines, index, nextLine.indent);
      out[key] = child.value;
      index = child.next;
    } else if (nextLine !== undefined && nextLine.indent === indent && nextLine.text.startsWith("- ")) {
      const child = parseSequence(lines, index, indent);
      out[key] = child.value;
      index = child.next;
    } else {
      out[key] = null;
    }
  }
  return { value: out, next: index };
}

export function parseYaml(text: string): Record<string, unknown> {
  const lines: Line[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === "") continue;
    const noComment = stripComment(raw.replace(/\t/g, "  "));
    if (noComment.trim() === "") continue;
    const indent = noComment.length - noComment.trimStart().length;
    lines.push({ indent, text: noComment.trim() });
  }
  if (lines.length === 0) return {};
  const parsed = parseBlock(lines, 0, lines[0]!.indent);
  if (parsed.next !== lines.length) throw new YamlError(`Unparsed trailing YAML at line ${parsed.next + 1}`);
  if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) {
    throw new YamlError("Policy YAML must be a mapping at the top level");
  }
  return parsed.value as Record<string, unknown>;
}
