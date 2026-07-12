import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { extractModuleSpecifiers } from "./parse.js";
import { isInternalSpecifier, resolveImport } from "./resolve.js";
import type { FileEdge, TsConfig } from "./types.js";

const EDGE_SEPARATOR = "\u0000";
const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export async function buildFileGraph(root: string, files: string[], config: TsConfig, configDirectory: string): Promise<{ edges: FileEdge[]; warnings: string[] }> {
  const edges = new Set<string>();
  const includedFiles = new Set(files);
  const warnings: string[] = [];
  for (const source of files) {
    let content: string;
    try { content = await readFile(join(root, source), "utf8"); }
    catch { warnings.push(`Unable to read file: ${source}`); continue; }
    let specifiers: string[];
    try { specifiers = extractModuleSpecifiers(content); }
    catch (error) { warnings.push(`Unable to parse file:\n${source}: ${error instanceof Error ? error.message : String(error)}`); continue; }
    for (const specifier of specifiers) {
      const target = await resolveImport(specifier, source, root, config, configDirectory);
      if (target && includedFiles.has(target)) edges.add(`${source}${EDGE_SEPARATOR}${target}`);
      else if (target) continue;
      else if (isInternalSpecifier(specifier, config)) warnings.push(`Unresolved import:\n${source}: ${specifier}`);
    }
  }
  const orderedEdges = [...edges]
    .map((edge) => {
      const [source, target] = edge.split(EDGE_SEPARATOR);
      return { source, target };
    })
    .sort((left, right) => compareText(left.source, right.source) || compareText(left.target, right.target));
  return { edges: orderedEdges, warnings };
}
