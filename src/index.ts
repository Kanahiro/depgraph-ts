import { resolve } from "node:path";
import { aggregateGraph } from "./aggregate.js";
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE, discoverFiles } from "./discover.js";
import { buildFileGraph } from "./graph.js";
import { readTsConfig } from "./resolve.js";
import type { AnalyzeOptions, DependencyMap } from "./types.js";

export async function analyze(rootInput: string, options: AnalyzeOptions = {}): Promise<DependencyMap> {
  const root = resolve(rootInput);
  const groupDepth = options.groupDepth ?? 2;
  if (!Number.isInteger(groupDepth) || groupDepth < 1) throw new Error("group-depth must be a positive integer");

  const tsconfigPath = resolve(root, options.tsconfig ?? "tsconfig.json");
  const includes = options.include?.length ? options.include : DEFAULT_INCLUDE;
  const excludes = [...DEFAULT_EXCLUDE, ...(options.exclude ?? [])];
  const files = await discoverFiles(root, includes, excludes);
  const config = await readTsConfig(tsconfigPath);
  const graph = await buildFileGraph(root, files, config, resolve(tsconfigPath, ".."));
  const aggregated = aggregateGraph(files, graph.edges, groupDepth);

  return { version: 1, root: ".", groupDepth, ...aggregated, warnings: graph.warnings.sort() };
}

export { diffMaps } from "./diff.js";
export { render, renderJson, renderMermaid } from "./render.js";
export type * from "./types.js";
