import type { DependencyMap, DependencyMapDiff, DirectoryEdge, DirectoryNode } from "./types.js";

const EDGE_SEPARATOR = "\u0000";
const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const edgeKey = (edge: Pick<DirectoryEdge, "source" | "target">): string => `${edge.source}${EDGE_SEPARATOR}${edge.target}`;

function sortNodes<T extends { id: string }>(nodes: T[]): T[] {
  return nodes.sort((left, right) => compareText(left.id, right.id));
}

function sortEdges<T extends { source: string; target: string }>(edges: T[]): T[] {
  return edges.sort((left, right) => compareText(left.source, right.source) || compareText(left.target, right.target));
}

/** Compares two maps created with the same directory grouping depth. */
export function diffMaps(before: DependencyMap, after: DependencyMap): DependencyMapDiff {
  if (before.version !== 1 || after.version !== 1) throw new Error("Only dependency map version 1 is supported");
  if (before.groupDepth !== after.groupDepth) {
    throw new Error(`Cannot compare maps with different group depths (${before.groupDepth} and ${after.groupDepth})`);
  }

  const beforeNodes = new Map(before.nodes.map((node) => [node.id, node.fileCount]));
  const afterNodes = new Map(after.nodes.map((node) => [node.id, node.fileCount]));
  const addedNodes: DirectoryNode[] = [];
  const removedNodes: DirectoryNode[] = [];
  const changedNodes: DependencyMapDiff["nodes"]["changed"] = [];

  for (const [id, fileCount] of afterNodes) {
    const previousCount = beforeNodes.get(id);
    if (previousCount === undefined) addedNodes.push({ id, fileCount });
    else if (previousCount !== fileCount) changedNodes.push({ id, before: previousCount, after: fileCount });
  }
  for (const [id, fileCount] of beforeNodes) {
    if (!afterNodes.has(id)) removedNodes.push({ id, fileCount });
  }

  const beforeEdges = new Map(before.edges.map((edge) => [edgeKey(edge), edge]));
  const afterEdges = new Map(after.edges.map((edge) => [edgeKey(edge), edge]));
  const addedEdges: DirectoryEdge[] = [];
  const removedEdges: DirectoryEdge[] = [];
  const changedEdges: DependencyMapDiff["edges"]["changed"] = [];

  for (const [key, edge] of afterEdges) {
    const previous = beforeEdges.get(key);
    if (previous === undefined) addedEdges.push(edge);
    else if (previous.count !== edge.count) changedEdges.push({ source: edge.source, target: edge.target, before: previous.count, after: edge.count });
  }
  for (const [key, edge] of beforeEdges) {
    if (!afterEdges.has(key)) removedEdges.push(edge);
  }

  return {
    version: 1,
    before: { root: before.root, groupDepth: before.groupDepth },
    after: { root: after.root, groupDepth: after.groupDepth },
    nodes: { added: sortNodes(addedNodes), removed: sortNodes(removedNodes), changed: sortNodes(changedNodes) },
    edges: { added: sortEdges(addedEdges), removed: sortEdges(removedEdges), changed: sortEdges(changedEdges) }
  };
}
