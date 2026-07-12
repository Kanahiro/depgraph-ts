export interface FileEdge {
  source: string;
  target: string;
}
export interface DirectoryNode {
  id: string;
  fileCount: number;
}
export interface DirectoryEdge {
  source: string;
  target: string;
  count: number;
}
export interface DependencyMap {
  version: 1;
  root: string;
  groupDepth: number;
  nodes: DirectoryNode[];
  edges: DirectoryEdge[];
  warnings: string[];
}
export interface FileCountChange {
  id: string;
  before: number;
  after: number;
}
export interface DependencyCountChange {
  source: string;
  target: string;
  before: number;
  after: number;
}
export interface DependencyMapDiff {
  version: 1;
  before: { root: string; groupDepth: number };
  after: { root: string; groupDepth: number };
  nodes: { added: DirectoryNode[]; removed: DirectoryNode[]; changed: FileCountChange[] };
  edges: { added: DirectoryEdge[]; removed: DirectoryEdge[]; changed: DependencyCountChange[] };
}
export type Renderable = DependencyMap | DependencyMapDiff;
export type OutputFormat = "json" | "mermaid";
export interface TsConfig {
  baseUrl?: string;
  paths?: Record<string, string[]>;
}
export interface AnalyzeOptions {
  include?: string[];
  exclude?: string[];
  groupDepth?: number;
  tsconfig?: string;
}
