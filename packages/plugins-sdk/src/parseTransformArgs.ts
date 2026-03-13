/**
 * Parse the transform-args inline editor string into an array of values.
 *
 * Before v1.0 refinement 1: richer parsing for transform argument editing UX.
 * Supports:
 * - Numbers: integers, decimals, negative (e.g. 2, 0.5, -.5, -0.25).
 * - Quoted strings: "..." or '...' (commas inside quotes are preserved).
 * - Unquoted tokens: kept as strings (e.g. tr909).
 * - Empty segments: produce undefined (for optional args; coercion layer applies defaults).
 *
 * PatternGraph remains the single mutation surface; this only parses UI input
 * before the app coerces via registry and updates the graph.
 */

/**
 * Split a string by commas, but do not split on commas inside quoted strings.
 */
function splitByCommaOutsideQuotes(raw: string): string[] {
  const segments: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar: string | null = null;

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!;
    if (inQuote) {
      if (c === quoteChar) {
        inQuote = false;
        quoteChar = null;
        current += c;
      } else {
        current += c;
      }
    } else if (c === '"' || c === "'") {
      inQuote = true;
      quoteChar = c;
      current += c;
    } else if (c === ",") {
      segments.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  segments.push(current);
  return segments;
}

/**
 * Parse a single segment (trimmed) into a number, quoted string, or string.
 */
function parseSegment(trimmed: string): unknown {
  if (trimmed === "") {
    return undefined;
  }
  const q = trimmed[0];
  if (
    (q === '"' && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (q === "'" && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  const num = Number(trimmed);
  if (!Number.isNaN(num)) {
    return num;
  }
  return trimmed;
}

/**
 * Parse the transform-args input string into an array suitable for coercion.
 *
 * - Numbers (including -.5, 0.5) become number; quoted strings become string;
 *   empty segments become undefined; other tokens remain string.
 * - Empty input returns [].
 */
export function parseTransformArgsString(raw: string): unknown[] {
  const trimmedInput = raw.trim();
  if (trimmedInput === "") {
    return [];
  }
  const segments = splitByCommaOutsideQuotes(trimmedInput);
  return segments.map((s) => parseSegment(s.trim()));
}
