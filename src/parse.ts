interface Token { kind: "word" | "string" | "punctuation"; value: string }

const isWordCharacter = (character: string): boolean => /[\w$]/.test(character);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  for (let index = 0; index < source.length;) {
    const character = source[index];
    if (/\s/.test(character)) { index += 1; continue; }
    if (character === "/" && source[index + 1] === "/") {
      const end = source.indexOf("\n", index + 2);
      index = end < 0 ? source.length : end + 1;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      if (end < 0) throw new SyntaxError("Unterminated block comment");
      index = end + 2;
      continue;
    }
    if (character === '"' || character === "'") {
      const quote = character;
      let value = "";
      let closed = false;
      for (index += 1; index < source.length; index += 1) {
        const current = source[index];
        if (current === "\\") {
          if (index + 1 >= source.length) throw new SyntaxError("Unterminated string literal");
          value += source[index + 1];
          index += 1;
        } else if (current === quote) {
          index += 1;
          closed = true;
          break;
        } else {
          if (current === "\n" || current === "\r") throw new SyntaxError("Unterminated string literal");
          value += current;
        }
      }
      if (!closed) throw new SyntaxError("Unterminated string literal");
      tokens.push({ kind: "string", value });
      continue;
    }
    if (character === "`") {
      let closed = false;
      for (index += 1; index < source.length; index += 1) {
        if (source[index] === "\\") index += 1;
        else if (source[index] === "`") { index += 1; closed = true; break; }
      }
      if (!closed) throw new SyntaxError("Unterminated template literal");
      continue;
    }
    if (isWordCharacter(character)) {
      const start = index;
      while (index < source.length && isWordCharacter(source[index])) index += 1;
      tokens.push({ kind: "word", value: source.slice(start, index) });
      continue;
    }
    tokens.push({ kind: "punctuation", value: character });
    index += 1;
  }
  return tokens;
}

function specifierAfterFrom(tokens: Token[], start: number): string | undefined {
  for (let index = start; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.value === ";") return undefined;
    if (index > start && token.kind === "word" && (token.value === "import" || token.value === "export")) return undefined;
    if (token.kind === "word" && token.value === "from" && tokens[index + 1]?.kind === "string") return tokens[index + 1].value;
  }
  return undefined;
}

/** Extracts specifiers from static ESM imports and re-exports without executing source code. */
export function extractModuleSpecifiers(source: string): string[] {
  const tokens = tokenize(source);
  const specifiers: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind !== "word" || (token.value !== "import" && token.value !== "export")) continue;
    const next = tokens[index + 1];
    if (token.value === "import" && next?.kind === "string") { specifiers.push(next.value); continue; }
    if (token.value === "import" && (next?.value === "(" || next?.value === ".")) continue;
    const specifier = specifierAfterFrom(tokens, index + 1);
    if (specifier !== undefined) specifiers.push(specifier);
  }
  return specifiers;
}
