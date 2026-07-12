import { readdir, lstat } from "node:fs/promises";
import { join, relative } from "node:path";

export const DEFAULT_INCLUDE = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"];
export const DEFAULT_EXCLUDE = ["node_modules/**", "dist/**", "build/**", "coverage/**", ".git/**", "**/*.test.*", "**/*.spec.*"];

function expandBraces(pattern: string): string[] {
  const match = /\{([^{}]+)\}/.exec(pattern);
  if (!match) return [pattern];
  return match[1].split(",").flatMap((part) => expandBraces(pattern.slice(0, match.index) + part + pattern.slice(match.index! + match[0].length)));
}

function globToRegExp(pattern: string): RegExp {
  let out = "^";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "*") {
      if (pattern[i + 1] === "*") { i += 1; if (pattern[i + 1] === "/") { i += 1; out += "(?:.*/)?"; } else out += ".*"; }
      else out += "[^/]*";
    } else if (char === "?") out += "[^/]";
    else out += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  }
  return new RegExp(`${out}$`);
}

function compileGlobs(patterns: string[]): RegExp[] {
  return patterns.flatMap(expandBraces).map(globToRegExp);
}

function matches(path: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(path));
}

export async function discoverFiles(root: string, include = DEFAULT_INCLUDE, exclude = DEFAULT_EXCLUDE): Promise<string[]> {
  const files: string[] = [];
  const includePatterns = compileGlobs(include);
  const excludePatterns = compileGlobs(exclude);
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      const path = relative(root, absolute).replaceAll("\\", "/");
      if (entry.isSymbolicLink() || matches(path, excludePatterns) || (entry.isDirectory() && matches(`${path}/`, excludePatterns))) continue;
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() && matches(path, includePatterns)) files.push(path);
    }
  }
  await lstat(root); // produce the native error for an invalid root
  await visit(root);
  return files.sort();
}
