import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { analyze, renderJson, renderMermaid } from "../dist/index.js";

async function fixture(files) {
  const root = await mkdtemp(join(tmpdir(), "pdm-"));
  await Promise.all(Object.entries(files).map(async ([path, content]) => {
    await mkdir(join(root, path, ".."), { recursive: true });
    await writeFile(join(root, path), content);
  }));
  return root;
}

test("analyzes, resolves and aggregates deterministic directory dependencies", async () => {
  const root = await fixture({
    "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@core/*": ["src/core/*"] } } }),
    "src/api/user.ts": 'import { user } from "../services/user"; import { log } from "@core/log"; import "./setup";',
    "src/api/setup.ts": "export {};",
    "src/services/user.ts": 'import { log } from "@core/log"; export const user = log;',
    "src/core/log.ts": "export const log = 1;",
    "src/ignored.test.ts": 'import "./core/log";'
  });
  const map = await analyze(root, { groupDepth: 2 });
  assert.deepEqual(map, {
    version: 1, root: ".", groupDepth: 2,
    nodes: [{ id: "src/api", fileCount: 2 }, { id: "src/core", fileCount: 1 }, { id: "src/services", fileCount: 1 }],
    edges: [{ source: "src/api", target: "src/core", count: 1 }, { source: "src/api", target: "src/services", count: 1 }, { source: "src/services", target: "src/core", count: 1 }],
    warnings: []
  });
  assert.equal(renderJson(map), renderJson(await analyze(root, { groupDepth: 2 })));
  assert.match(renderMermaid(map), /^flowchart LR\n/);
  assert.match(renderMermaid(map), /-->|"1"\|/);
});

test("records unresolved internal imports but ignores external packages", async () => {
  const root = await fixture({ "src/a.ts": 'import "./missing"; import "lodash";' });
  const map = await analyze(root);
  assert.deepEqual(map.warnings, ["Unresolved import:\nsrc/a.ts: ./missing"]);
});

test("supports include and directory index resolution", async () => {
  const root = await fixture({ "src/a.ts": 'import "../lib";', "lib/index.js": "export {};", "extra/x.js": "export {};" });
  const map = await analyze(root, { include: ["src/**/*.ts", "lib/**/*.js"], groupDepth: 1 });
  assert.deepEqual(map.nodes, [{ id: "lib", fileCount: 1 }, { id: "src", fileCount: 1 }]);
  assert.deepEqual(map.edges, [{ source: "src", target: "lib", count: 1 }]);
});

test("treats ESM re-exports as dependencies", async () => {
  const root = await fixture({
    "src/public/index.ts": 'export { user } from "../services/user"; export * from "../shared"; export type { Model } from "../models/model";',
    "src/services/user.ts": "export const user = 1;",
    "src/shared/index.ts": "export const shared = 1;",
    "src/models/model.ts": "export interface Model { id: string }"
  });
  const map = await analyze(root, { groupDepth: 2 });
  assert.deepEqual(map.edges, [
    { source: "src/public", target: "src/models", count: 1 },
    { source: "src/public", target: "src/services", count: 1 },
    { source: "src/public", target: "src/shared", count: 1 }
  ]);
});

test("ignores comments, strings, templates, and dynamic imports", async () => {
  const root = await fixture({
    "src/api/index.ts": '// import "../fake/comment";\nconst text = \'import "../fake/string"\';\nconst template = `import "../fake/template"`;\nimport("../fake/dynamic");\nexport { value } from "../core/value";',
    "src/core/value.ts": "export const value = 1;"
  });
  const map = await analyze(root, { groupDepth: 2 });
  assert.deepEqual(map.edges, [{ source: "src/api", target: "src/core", count: 1 }]);
  assert.deepEqual(map.warnings, []);
});

test("reports malformed source and omits dependencies to excluded files", async () => {
  const root = await fixture({
    "src/api/broken.ts": "import './unterminated",
    "src/api/valid.ts": 'import "../test-support/helper.test";',
    "src/test-support/helper.test.ts": "export {};"
  });
  const map = await analyze(root, { groupDepth: 2 });
  assert.deepEqual(map.nodes, [{ id: "src/api", fileCount: 2 }]);
  assert.deepEqual(map.edges, []);
  assert.deepEqual(map.warnings, ["Unable to parse file:\nsrc/api/broken.ts: Unterminated string literal"]);
});

test("reads comments and trailing commas in tsconfig", async () => {
  const root = await fixture({
    "tsconfig.json": '{\n// aliases\n"compilerOptions": { "baseUrl": ".", "paths": { "@core/*": ["src/core/*",], }, },\n}',
    "src/api/a.ts": 'import "@core/value";',
    "src/core/value.ts": "export {};"
  });
  const map = await analyze(root, { groupDepth: 2 });
  assert.deepEqual(map.edges, [{ source: "src/api", target: "src/core", count: 1 }]);
});
