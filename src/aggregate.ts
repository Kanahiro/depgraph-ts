import { dirname } from "node:path";
import type { DirectoryEdge, DirectoryNode, FileEdge } from "./types.js";

const EDGE_SEPARATOR = "\u0000";
const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export function groupPath(file: string, depth: number): string {
  const directories = dirname(file)
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => part !== "" && part !== ".");
  return directories.slice(0, depth).join("/") || ".";
}

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

export function aggregateGraph(files: string[], fileEdges: FileEdge[], depth: number): { nodes: DirectoryNode[]; edges: DirectoryEdge[] } {
  const fileCounts = new Map<string, number>();
  for (const file of files) increment(fileCounts, groupPath(file, depth));

  const dependencyCounts = new Map<string, number>();
  for (const edge of fileEdges) {
    const source = groupPath(edge.source, depth);
    const target = groupPath(edge.target, depth);
    if (source !== target) increment(dependencyCounts, `${source}${EDGE_SEPARATOR}${target}`);
  }

  const nodes = [...fileCounts]
    .map(([id, fileCount]) => ({ id, fileCount }))
    .sort((left, right) => compareText(left.id, right.id));
  const edges = [...dependencyCounts]
    .map(([key, count]) => {
      const [source, target] = key.split(EDGE_SEPARATOR);
      return { source, target, count };
    })
    .sort((left, right) => compareText(left.source, right.source) || compareText(left.target, right.target));

  return { nodes, edges };
}
