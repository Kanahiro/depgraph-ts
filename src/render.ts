import type { DependencyMap, DependencyMapDiff, OutputFormat, Renderable } from "./types.js";

const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

function nodeId(path: string): string {
  return `n_${[...path].map((character) => character.codePointAt(0)!.toString(16)).join("_")}`;
}
function quote(value: string): string { return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"'); }

export function renderJson(value: Renderable): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function renderMapMermaid(map: DependencyMap): string {
  const lines = ["flowchart LR"];
  for (const node of map.nodes) lines.push(`  ${nodeId(node.id)}["${quote(node.id)}\\n${node.fileCount} ${node.fileCount === 1 ? "file" : "files"}"]`);
  if (map.nodes.length && map.edges.length) lines.push("");
  for (const edge of map.edges) lines.push(`  ${nodeId(edge.source)} -->|"${edge.count}"| ${nodeId(edge.target)}`);
  return `${lines.join("\n")}\n`;
}

/** Renders additions, removals, and count changes using labels and dotted removed edges. */
function renderDiffMermaid(diff: DependencyMapDiff): string {
  const lines = ["flowchart LR"];
  const nodes = [
    ...diff.nodes.added.map((node) => ({ id: node.id, text: `+ ${node.fileCount} ${node.fileCount === 1 ? "file" : "files"}` })),
    ...diff.nodes.removed.map((node) => ({ id: node.id, text: `- ${node.fileCount} ${node.fileCount === 1 ? "file" : "files"}` })),
    ...diff.nodes.changed.map((node) => ({ id: node.id, text: `${node.before} → ${node.after} files` }))
  ].sort((left, right) => compareText(left.id, right.id));
  for (const node of nodes) lines.push(`  ${nodeId(node.id)}["${quote(node.id)}\\n${node.text}"]`);
  const hasEdges = diff.edges.added.length + diff.edges.removed.length + diff.edges.changed.length > 0;
  if (nodes.length && hasEdges) lines.push("");
  for (const edge of diff.edges.added) lines.push(`  ${nodeId(edge.source)} -->|"+${edge.count}"| ${nodeId(edge.target)}`);
  for (const edge of diff.edges.removed) lines.push(`  ${nodeId(edge.source)} -.->|"-${edge.count}"| ${nodeId(edge.target)}`);
  for (const edge of diff.edges.changed) lines.push(`  ${nodeId(edge.source)} -->|"${edge.before} → ${edge.after}"| ${nodeId(edge.target)}`);
  return `${lines.join("\n")}\n`;
}

function isDiff(value: Renderable): value is DependencyMapDiff {
  return "before" in value && "after" in value;
}

export function renderMermaid(value: Renderable): string {
  return isDiff(value) ? renderDiffMermaid(value) : renderMapMermaid(value);
}

export function render(value: Renderable, format: OutputFormat): string {
  return format === "json" ? renderJson(value) : renderMermaid(value);
}
