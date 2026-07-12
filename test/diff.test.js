import assert from "node:assert/strict";
import test from "node:test";
import { diffMaps, render, renderJson, renderMermaid } from "../dist/index.js";

const before = { version: 1, root: ".", groupDepth: 2, warnings: [], nodes: [{ id: "src/api", fileCount: 2 }, { id: "src/core", fileCount: 1 }, { id: "src/old", fileCount: 1 }], edges: [{ source: "src/api", target: "src/core", count: 1 }, { source: "src/old", target: "src/core", count: 2 }] };
const after = { version: 1, root: ".", groupDepth: 2, warnings: [], nodes: [{ id: "src/api", fileCount: 3 }, { id: "src/core", fileCount: 1 }, { id: "src/new", fileCount: 2 }], edges: [{ source: "src/api", target: "src/core", count: 4 }, { source: "src/api", target: "src/new", count: 1 }] };

test("diffs added, removed, and changed nodes and edges deterministically", () => {
  const diff = diffMaps(before, after);
  assert.deepEqual(diff.nodes, {
    added: [{ id: "src/new", fileCount: 2 }], removed: [{ id: "src/old", fileCount: 1 }], changed: [{ id: "src/api", before: 2, after: 3 }]
  });
  assert.deepEqual(diff.edges, {
    added: [{ source: "src/api", target: "src/new", count: 1 }], removed: [{ source: "src/old", target: "src/core", count: 2 }], changed: [{ source: "src/api", target: "src/core", before: 1, after: 4 }]
  });
  assert.equal(renderJson(diff), renderJson(diffMaps(before, after)));
  assert.match(render(diff, "mermaid"), /\+1/);
  assert.match(renderMermaid(diff), /-.->\|"-2"\|/);
});

test("refuses maps with different group depth", () => {
  assert.throws(() => diffMaps(before, { ...after, groupDepth: 3 }), /different group depths/);
});

test("renders maps and diffs through the same API", () => {
  assert.match(renderJson(before), /"version": 1/);
  assert.equal(render(before, "json"), renderJson(before));
  assert.equal(render(before, "mermaid"), renderMermaid(before));
});
