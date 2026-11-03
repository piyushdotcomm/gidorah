/**
 * Benchmark task set.
 *
 * Class A tasks are repo-local fixes: all information needed is in the fixture.
 * Class B tasks are runtime-docs-dependent: the fixture is deliberately empty of
 * the answer and the correct implementation uses a current Node 26 API
 * (`node:sqlite`, `AbortSignal.any`, `process.loadEnvFile`, `crypto.hash`, the
 * `node:test` mock API, `Response` streaming). A model with stale knowledge has
 * to look these up, which is exactly what Tavily is for in arm D.
 *
 * Fixtures are real files with real `node:test` tests. Nothing is mocked at the
 * test level: the test command runs the code that was edited.
 */
import type { BenchTask } from "./index.ts";

function files(moduleName: string, moduleSource: string, testSource: string): Record<string, string> {
  return {
    [`${moduleName}.mjs`]: moduleSource,
    [`${moduleName}.test.mjs`]: testSource,
    "package.json": JSON.stringify({ name: `fixture-${moduleName}`, type: "module", private: true }, null, 2),
  };
}

const testCommand = (name: string) => `node --test --test-isolation=none ${name}.test.mjs`;

export const BENCH_TASKS: BenchTask[] = [
  {
    id: "A1", class: "A", name: "fix arithmetic helper", fixture: "bench-a1", allowedResearch: 0,
    goal: "make the failing local test pass",
    files: files("math", "export function compute(n) { return n + 100; }\n", "import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { compute } from './math.mjs';\ntest('compute', () => { assert.equal(compute(2), 200); });\n"),
    edit: { path: "math.mjs", find: "return n + 100;", replace: "return n * 100;" }, testCommand: testCommand("math"),
  },
  {
    id: "A2", class: "A", name: "fix slug helper", fixture: "bench-a2", allowedResearch: 0,
    goal: "make the failing local test pass",
    files: files("slug", "export function slug(value) { return value.trim().toLowerCase(); }\n", "import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { slug } from './slug.mjs';\ntest('slug', () => { assert.equal(slug('Hello World'), 'hello-world'); });\n"),
    edit: { path: "slug.mjs", find: "return value.trim().toLowerCase();", replace: "return value.trim().toLowerCase().replaceAll(' ', '-');" }, testCommand: testCommand("slug"),
  },
  {
    id: "A3", class: "A", name: "fix unique helper", fixture: "bench-a3", allowedResearch: 0,
    goal: "make the failing local test pass",
    files: files("unique", "export function unique(values) { return values; }\n", "import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { unique } from './unique.mjs';\ntest('unique', () => { assert.deepEqual(unique([1, 1, 2, 3, 3]), [1, 2, 3]); });\n"),
    edit: { path: "unique.mjs", find: "return values;", replace: "return [...new Set(values)];" }, testCommand: testCommand("unique"),
  },
  {
    id: "A4", class: "A", name: "fix paging helper", fixture: "bench-a4", allowedResearch: 0,
    goal: "make the failing local test pass",
    files: files("paging", "export function pageOf(items, page, size) { return items.slice(0, size); }\n", "import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { pageOf } from './paging.mjs';\ntest('page 2', () => { assert.deepEqual(pageOf([1, 2, 3, 4, 5], 2, 2), [3, 4]); });\n"),
    edit: { path: "paging.mjs", find: "return items.slice(0, size);", replace: "return items.slice((page - 1) * size, page * size);" }, testCommand: testCommand("paging"),
  },
  {
    id: "A5", class: "A", name: "fix csv parser", fixture: "bench-a5", allowedResearch: 0,
    goal: "make the failing local test pass",
    files: files("csv", "export function parseCsv(line) { return line.split(','); }\n", "import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { parseCsv } from './csv.mjs';\ntest('quoted commas', () => { assert.deepEqual(parseCsv('a,\"b,c\",d'), ['a', 'b,c', 'd']); });\n"),
    edit: { path: "csv.mjs", find: "return line.split(',');", replace: "return line.match(/(\"[^\"]*\"|[^,]+)/g).map((part) => part.replaceAll('\"', ''));" }, testCommand: testCommand("csv"),
  },
  {
    id: "A6", class: "A", name: "fix validator", fixture: "bench-a6", allowedResearch: 0,
    goal: "make the failing local test pass",
    files: files("validate", "export function validEmail(value) { return true; }\n", "import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { validEmail } from './validate.mjs';\ntest('rejects', () => { assert.equal(validEmail('nope'), false); assert.equal(validEmail('a@b.co'), true); });\n"),
    edit: { path: "validate.mjs", find: "return true;", replace: "return /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(value);" }, testCommand: testCommand("validate"),
  },
  {
    id: "B1", class: "B", name: "use the current node:sqlite API", fixture: "bench-b1", allowedResearch: 2,
    goal: "implement countRows using the current Node 26 node:sqlite API and make the test pass; consult current Node docs if unsure",
    files: files("db", "export function countRows() {\n  throw new Error('not implemented');\n}\n", "import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { countRows } from './db.mjs';\ntest('counts rows', () => { assert.equal(countRows(), 2); });\n"),
    edit: { path: "db.mjs", find: "export function countRows() {\n  throw new Error('not implemented');\n}", replace: "import { DatabaseSync } from 'node:sqlite';\n\nexport function countRows() {\n  const db = new DatabaseSync(':memory:');\n  db.exec('CREATE TABLE t (id INTEGER)');\n  db.prepare('INSERT INTO t (id) VALUES (?)').run(1);\n  db.prepare('INSERT INTO t (id) VALUES (?)').run(2);\n  const row = db.prepare('SELECT COUNT(*) AS n FROM t').get();\n  db.close();\n  return row.n;\n}" }, testCommand: testCommand("db"),
  },
  {
    id: "B2", class: "B", name: "combine abort signals", fixture: "bench-b2", allowedResearch: 2,
    goal: "implement abortable so either signal aborts it; use the current AbortSignal composition API and consult Node docs if unsure",
    files: files("abort", "export function abortable(signals) {\n  throw new Error('not implemented');\n}\n", "import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { abortable } from './abort.mjs';\ntest('either signal aborts', () => {\n  const a = new AbortController();\n  const b = new AbortController();\n  const signal = abortable([a.signal, b.signal]);\n  b.abort('stop');\n  assert.equal(signal.aborted, true);\n});\n"),
    edit: { path: "abort.mjs", find: "export function abortable(signals) {\n  throw new Error('not implemented');\n}", replace: "export function abortable(signals) {\n  return AbortSignal.any(signals);\n}" }, testCommand: testCommand("abort"),
  },
  {
    id: "B3", class: "B", name: "load env file", fixture: "bench-b3", allowedResearch: 2,
    goal: "implement loadToken by loading .env with the current Node API and make the test pass; consult Node docs if unsure",
    files: { ...files("envfile", "export function loadToken() {\n  throw new Error('not implemented');\n}", "import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { loadToken } from './envfile.mjs';\ntest('loads .env', () => { assert.equal(loadToken(), 'abc123'); });\n"), ".env": "BENCH_TOKEN=abc123\n" },
    edit: { path: "envfile.mjs", find: "export function loadToken() {\n  throw new Error('not implemented');\n}", replace: "import { loadEnvFile } from 'node:process';\n\nexport function loadToken() {\n  loadEnvFile('.env');\n  return process.env.BENCH_TOKEN;\n}" }, testCommand: testCommand("envfile"),
  },
  {
    id: "B4", class: "B", name: "one-shot digest", fixture: "bench-b4", allowedResearch: 2,
    goal: "implement digest with the current Node crypto one-shot hash API and make the test pass; consult Node docs if unsure",
    files: files("digest", "export function digest(value) {\n  throw new Error('not implemented');\n}", "import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { digest } from './digest.mjs';\ntest('sha256', () => { assert.equal(digest('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'); });\n"),
    edit: { path: "digest.mjs", find: "export function digest(value) {\n  throw new Error('not implemented');\n}", replace: "import { hash } from 'node:crypto';\n\nexport function digest(value) {\n  return hash('sha256', value, 'hex');\n}" }, testCommand: testCommand("digest"),
  },
  {
    id: "B5", class: "B", name: "mock a function with node:test", fixture: "bench-b5", allowedResearch: 2,
    goal: "implement countedRun so it calls the callback once; use the current node:test mock API and consult Node docs if unsure",
    files: files("mockfn", "export function countedRun(callback) {\n  throw new Error('not implemented');\n}", "import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { countedRun } from './mockfn.mjs';\ntest('calls once', (t) => {\n  const fn = t.mock.fn(() => 7);\n  assert.equal(countedRun(fn), 7);\n  assert.equal(fn.mock.callCount(), 1);\n});\n"),
    edit: { path: "mockfn.mjs", find: "export function countedRun(callback) {\n  throw new Error('not implemented');\n}", replace: "export function countedRun(callback) {\n  return callback();\n}" }, testCommand: testCommand("mockfn"),
  },
  {
    id: "B6", class: "B", name: "read a streaming response", fixture: "bench-b6", allowedResearch: 2,
    goal: "implement bodyOf by reading a streaming Response body to text; use the current Response API and consult Node docs if unsure",
    files: files("body", "export async function bodyOf(response) {\n  throw new Error('not implemented');\n}", "import assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { bodyOf } from './body.mjs';\ntest('reads stream', async () => {\n  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('hello')); controller.close(); } }));\n  assert.equal(await bodyOf(response), 'hello');\n});\n"),
    edit: { path: "body.mjs", find: "export async function bodyOf(response) {\n  throw new Error('not implemented');\n}", replace: "export async function bodyOf(response) {\n  return response.text();\n}" }, testCommand: testCommand("body"),
  },
];
