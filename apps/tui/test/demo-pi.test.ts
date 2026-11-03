import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("DEMO-pi.md is UTF-8 pi-tui frames with the required scenes", () => {
  const bytes = readFileSync(new URL("../DEMO-pi.md", import.meta.url));
  assert.equal(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf, false);
  assert.equal(bytes.includes(0), false);
  const text = bytes.toString("utf8");
  assert.ok(text.startsWith("# Gidorah pi-tui demo"));
  assert.equal(text.includes("\u001b"), false);
  for (const scene of ["### 1. Header", "### 2. Edit approval", "### 3. Denied shell", "### 4. /status", "### 5. Searchable /resume", "### 6. /model"]) {
    assert.ok(text.includes(scene), `missing ${scene}`);
  }
  assert.match(text, /approval required/);
  assert.match(text, /\[y\] allow/);
  assert.match(text, /research/);
  assert.match(text, /takeover/);
  assert.match(text, /receipt/);
});
