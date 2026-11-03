import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const demoPath = new URL("../DEMO.md", import.meta.url);

test("DEMO.md is UTF-8 text with the required TUI scenes", () => {
  const bytes = readFileSync(demoPath);
  assert.equal(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf, false, "DEMO.md must not have a UTF-8 BOM");
  assert.equal(bytes.includes(0), false, "DEMO.md must not contain NUL bytes");
  const text = bytes.toString("utf8");
  assert.ok(text.startsWith("# Gidorah native TUI demo"), "missing demo header");
  assert.equal(text.includes("\u001b"), false, "DEMO.md must not contain ANSI escapes");
  assert.ok(text.endsWith("\n"), "DEMO.md should end with a newline");
  for (const scene of [
    "### 1. Streaming",
    "### 2. Edit approval",
    "### 3. Shell approval",
    "### 4. Research card",
    "### 5. Turn complete",
    "### 6. /status",
    "### 7. /resume",
    "### 8. /model",
  ]) {
    assert.ok(text.includes(scene), `DEMO.md is missing scene: ${scene}`);
  }
});
