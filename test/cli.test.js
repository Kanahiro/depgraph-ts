import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

function run(arguments_) {
  return spawnSync(process.execPath, [cli, ...arguments_], { encoding: "utf8" });
}

test("CLI rejects unknown and duplicate options", () => {
  const unknown = run(["analyze", ".", "--unknown", "value"]);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown option/);
  const duplicate = run(["analyze", ".", "--format", "json", "--format", "mermaid"]);
  assert.equal(duplicate.status, 1);
  assert.match(duplicate.stderr, /only be specified once/);
});

test("CLI validates dependency map contents before diffing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pdm-cli-"));
  const invalid = join(directory, "invalid.json");
  await writeFile(invalid, JSON.stringify({ version: 1, root: ".", groupDepth: 2, nodes: [{}], edges: [], warnings: [] }));
  const result = run(["diff", invalid, invalid]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid dependency map/);
});

test("CLI compares two project trees directly", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pdm-compare-"));
  const before = join(directory, "before");
  const after = join(directory, "after");
  for (const root of [before, after]) {
    await mkdir(join(root, "src/api"), { recursive: true });
    await mkdir(join(root, "src/core"), { recursive: true });
    await writeFile(join(root, "src/core/value.ts"), "export const value = 1;");
  }
  await writeFile(join(before, "src/api/index.ts"), "export {};");
  await writeFile(join(after, "src/api/index.ts"), 'import { value } from "../core/value"; export { value };');

  const result = run(["compare", before, after, "--group-depth", "2", "--format", "json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).edges.added, [{ source: "src/api", target: "src/core", count: 1 }]);
});
