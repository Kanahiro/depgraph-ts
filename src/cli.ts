#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { analyze, diffMaps, render } from "./index.js";
import type { AnalyzeOptions, DependencyMap, OutputFormat } from "./types.js";

const USAGE = "Usage:\n  pdm analyze <root> [--include <glob>] [--exclude <glob>] [--group-depth <number>] [--format json|mermaid] [--output <path>] [--tsconfig <path>]\n  pdm diff <before.json> <after.json> [--format json|mermaid] [--output <path>]\n  pdm compare <before-root> <after-root> [--include <glob>] [--exclude <glob>] [--group-depth <number>] [--format json|mermaid] [--output <path>] [--tsconfig <path>]";
const ANALYZE_OPTIONS = new Set(["include", "exclude", "group-depth", "format", "output", "tsconfig"]);
const DIFF_OPTIONS = new Set(["format", "output"]);
const REPEATABLE_OPTIONS = new Set(["include", "exclude"]);

interface ParsedArguments { positional: string[]; options: Map<string, string[]> }

function fail(message: string): never { throw new Error(`${message}\n${USAGE}`); }

function parseArguments(arguments_: string[], allowedOptions: Set<string>): ParsedArguments {
  const positional: string[] = [];
  const options = new Map<string, string[]>();
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (!argument.startsWith("--")) { positional.push(argument); continue; }
    const name = argument.slice(2);
    if (!allowedOptions.has(name)) fail(`Unknown option: ${argument}`);
    const value = arguments_[index + 1];
    if (value === undefined || value.startsWith("--")) fail(`Missing value for option: ${argument}`);
    if (!REPEATABLE_OPTIONS.has(name) && options.has(name)) fail(`Option may only be specified once: ${argument}`);
    const values = options.get(name) ?? [];
    values.push(value);
    options.set(name, values);
    index += 1;
  }
  return { positional, options };
}

function single(options: Map<string, string[]>, name: string): string | undefined { return options.get(name)?.[0]; }

function outputFormat(options: Map<string, string[]>): OutputFormat {
  const format = single(options, "format") ?? "json";
  if (format !== "json" && format !== "mermaid") fail(`Unsupported format: ${format}`);
  return format;
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isPositiveInteger(value: unknown): value is number { return Number.isInteger(value) && (value as number) > 0; }
function isDirectoryNode(value: unknown): boolean { return isRecord(value) && typeof value.id === "string" && isPositiveInteger(value.fileCount); }
function isDirectoryEdge(value: unknown): boolean { return isRecord(value) && typeof value.source === "string" && typeof value.target === "string" && isPositiveInteger(value.count); }

function isDependencyMap(value: unknown): value is DependencyMap {
  return isRecord(value)
    && value.version === 1
    && value.root === "."
    && isPositiveInteger(value.groupDepth)
    && Array.isArray(value.nodes) && value.nodes.every(isDirectoryNode)
    && Array.isArray(value.edges) && value.edges.every(isDirectoryEdge)
    && Array.isArray(value.warnings) && value.warnings.every((warning) => typeof warning === "string");
}

async function loadMap(path: string): Promise<DependencyMap> {
  let value: unknown;
  try { value = JSON.parse(await readFile(path, "utf8")); }
  catch (error) { throw new Error(`Unable to read dependency map ${path}: ${error instanceof Error ? error.message : String(error)}`); }
  if (!isDependencyMap(value)) throw new Error(`Invalid dependency map: ${path}`);
  return value;
}

async function writeOutput(content: string, path?: string): Promise<void> {
  if (path) await writeFile(path, content, "utf8");
  else process.stdout.write(content);
}

async function runAnalyze(arguments_: string[]): Promise<void> {
  const { positional, options } = parseArguments(arguments_, ANALYZE_OPTIONS);
  if (positional.length !== 1) fail("Expected: pdm analyze <root>");
  const map = await analyze(positional[0], analyzeOptions(options));
  await writeOutput(render(map, outputFormat(options)), single(options, "output"));
  for (const warning of map.warnings) process.stderr.write(`${warning}\n`);
}

function analyzeOptions(options: Map<string, string[]>): AnalyzeOptions {
  const depthValue = single(options, "group-depth");
  return {
    include: options.get("include"), exclude: options.get("exclude"),
    groupDepth: depthValue === undefined ? undefined : Number(depthValue),
    tsconfig: single(options, "tsconfig")
  };
}

async function runDiff(arguments_: string[]): Promise<void> {
  const { positional, options } = parseArguments(arguments_, DIFF_OPTIONS);
  if (positional.length !== 2) fail("Expected: pdm diff <before.json> <after.json>");
  const diff = diffMaps(await loadMap(positional[0]), await loadMap(positional[1]));
  await writeOutput(render(diff, outputFormat(options)), single(options, "output"));
}

async function runCompare(arguments_: string[]): Promise<void> {
  const { positional, options } = parseArguments(arguments_, ANALYZE_OPTIONS);
  if (positional.length !== 2) fail("Expected: pdm compare <before-root> <after-root>");
  const configuration = analyzeOptions(options);
  const [before, after] = await Promise.all([
    analyze(positional[0], configuration),
    analyze(positional[1], configuration)
  ]);
  for (const warning of before.warnings) process.stderr.write(`[before] ${warning}\n`);
  for (const warning of after.warnings) process.stderr.write(`[after] ${warning}\n`);
  await writeOutput(render(diffMaps(before, after), outputFormat(options)), single(options, "output"));
}

async function main(arguments_: string[]): Promise<void> {
  const [command, ...rest] = arguments_;
  if (command === "analyze") return runAnalyze(rest);
  if (command === "diff") return runDiff(rest);
  if (command === "compare") return runCompare(rest);
  fail("Expected an analyze, diff, or compare command");
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
