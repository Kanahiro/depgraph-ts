import { readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import type { TsConfig } from "./types.js";

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const exists = async (path: string): Promise<boolean> => stat(path).then((entry) => entry.isFile()).catch(() => false);
const slash = (path: string) => path.replaceAll("\\", "/");

function removeTrailingCommas(source: string): string {
  let result = "";
  let inString = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      result += character;
      if (character === "\\" && index + 1 < source.length) result += source[++index];
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') { inString = true; result += character; continue; }
    if (character === ",") {
      let next = index + 1;
      while (/\s/.test(source[next] ?? "")) next += 1;
      if (source[next] === "}" || source[next] === "]") continue;
    }
    result += character;
  }
  return result;
}

function normalizeJsonc(source: string): string {
  let result = "";
  let quote: '"' | null = null;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      result += character;
      if (character === "\\" && index + 1 < source.length) result += source[++index];
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"') { quote = character; result += character; continue; }
    if (character === "/" && source[index + 1] === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      result += "\n";
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      if (end < 0) throw new SyntaxError("Unterminated block comment in tsconfig");
      result += source.slice(index, end + 2).replace(/[^\n\r]/g, " ");
      index = end + 1;
      continue;
    }
    result += character;
  }
  return removeTrailingCommas(result);
}

export async function readTsConfig(path: string): Promise<TsConfig> {
  try {
    const raw = await readFile(path, "utf8");
    const json = JSON.parse(normalizeJsonc(raw)) as { compilerOptions?: TsConfig };
    return json.compilerOptions ?? {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function resolveCandidate(candidate: string): Promise<string | undefined> {
  const extension = EXTENSIONS.find((ext) => candidate.endsWith(ext));
  const withoutExtension = extension ? candidate.slice(0, -extension.length) : candidate;
  const choices = [candidate, ...EXTENSIONS.map((ext) => withoutExtension + ext), ...EXTENSIONS.map((ext) => join(candidate, `index${ext}`))];
  for (const choice of choices) if (await exists(choice)) return normalize(choice);
  return undefined;
}

function pathCandidates(specifier: string, config: TsConfig, configDirectory: string): string[] {
  const candidates: string[] = [];
  for (const [pattern, targets] of Object.entries(config.paths ?? {})) {
    const star = pattern.indexOf("*");
    const matches = star < 0 ? specifier === pattern : specifier.startsWith(pattern.slice(0, star)) && specifier.endsWith(pattern.slice(star + 1));
    if (!matches) continue;
    const value = star < 0 ? "" : specifier.slice(star, specifier.length - (pattern.length - star - 1));
    for (const target of targets) candidates.push(join(configDirectory, config.baseUrl ?? ".", target.replace("*", value)));
  }
  if (config.baseUrl) candidates.push(join(configDirectory, config.baseUrl, specifier));
  return candidates;
}

export function isInternalSpecifier(specifier: string, config: TsConfig): boolean {
  if (specifier.startsWith(".")) return true;
  if (config.baseUrl) return true;
  return Object.keys(config.paths ?? {}).some((pattern) => {
    const star = pattern.indexOf("*");
    return star < 0 ? pattern === specifier : specifier.startsWith(pattern.slice(0, star)) && specifier.endsWith(pattern.slice(star + 1));
  });
}

export async function resolveImport(specifier: string, sourceFile: string, root: string, config: TsConfig, configDirectory: string): Promise<string | undefined> {
  const candidates = specifier.startsWith(".") ? [resolve(dirname(join(root, sourceFile)), specifier)] : pathCandidates(specifier, config, configDirectory);
  for (const candidate of candidates) {
    const resolved = await resolveCandidate(candidate);
    if (resolved) {
      const path = slash(relative(root, resolved));
      if (path && !path.startsWith("../") && !isAbsolute(path)) return path;
    }
  }
  return undefined;
}
