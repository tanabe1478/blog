// Small helpers for editing the frontmatter and leading heading of a Markdown page.
// They work on lines instead of a YAML parser because moonbit-ssg only reads
// flat `key: value` lines, and keeping every untouched line avoids noisy diffs.

const fence = "---";

type Parts = { lines: string[] | null; rest: string };

function splitFrontmatter(source: string): Parts {
  if (!source.startsWith(`${fence}\n`)) return { lines: null, rest: source };
  const end = source.indexOf(`\n${fence}`, fence.length);
  if (end === -1) return { lines: null, rest: source };
  const afterFence = end + fence.length + 1;
  if (afterFence < source.length && source[afterFence] !== "\n") return { lines: null, rest: source };
  const body = source.slice(fence.length + 1, end);
  return {
    lines: body === "" ? [] : body.split("\n"),
    rest: source.slice(Math.min(afterFence + 1, source.length)),
  };
}

function joinFrontmatter(lines: string[], rest: string): string {
  if (lines.length === 0) return rest;
  return `${fence}\n${lines.join("\n")}\n${fence}\n${rest}`;
}

function keyOf(line: string): string | null {
  const index = line.indexOf(":");
  return index === -1 ? null : line.slice(0, index).trim();
}

function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    if ((first === '"' || first === "'") && value.endsWith(first)) return value.slice(1, -1);
  }
  return value;
}

// moonbit-ssg strips one pair of quotes without unescaping, so a value is quoted
// only when YAML-aware tools would misread it, and `'` is used when it holds `"`.
function quote(value: string): string {
  const needsQuotes =
    value !== value.trim() || /^[@`"'#&*!|>%{}[\]\-?,]/.test(value) || /: |:$| #|"/.test(value);
  if (!needsQuotes) return value;
  return value.includes('"') ? `'${value}'` : `"${value}"`;
}

export function readFrontmatterValue(source: string, key: string): string {
  const { lines } = splitFrontmatter(source);
  const line = lines?.find((candidate) => keyOf(candidate) === key);
  if (!line) return "";
  return unquote(line.slice(line.indexOf(":") + 1).trim());
}

// Replaces, appends or (with null) removes one key, leaving every other line as is.
export function setFrontmatterValue(source: string, key: string, value: string | null): string {
  const { lines, rest } = splitFrontmatter(source);
  const current = lines ?? [];
  const index = current.findIndex((line) => keyOf(line) === key);
  const next = [...current];
  if (value === null) {
    if (index === -1) return source;
    next.splice(index, 1);
  } else {
    const line = `${key}: ${quote(value.replace(/\s*\n\s*/g, " "))}`;
    if (index === -1) next.push(line);
    else next[index] = line;
  }
  return joinFrontmatter(next, rest);
}

type HeadingParts = { prefix: string; heading: string | null; body: string };

function splitHeadingParts(source: string): HeadingParts {
  const { lines, rest } = splitFrontmatter(source);
  const frontmatter = lines === null ? "" : source.slice(0, source.length - rest.length);
  const blank = /^\n*/.exec(rest)?.[0] ?? "";
  const afterBlank = rest.slice(blank.length);
  const match = /^#(?: (.*))?(?:\n|$)/.exec(afterBlank);
  if (!match) return { prefix: frontmatter + blank, heading: null, body: afterBlank };
  return {
    prefix: frontmatter + blank,
    heading: (match[1] ?? "").trim(),
    body: afterBlank.slice(match[0].length).replace(/^\n+/, ""),
  };
}

// The page title is the first `# heading` after the frontmatter; the rest is the body.
export function splitHeading(source: string): { heading: string; body: string } {
  const { heading, body } = splitHeadingParts(source);
  return { heading: heading ?? "", body };
}

export function joinHeading(source: string, heading: string, body: string): string {
  const { prefix } = splitHeadingParts(source);
  return `${prefix}# ${heading.trim()}\n\n${body}`;
}
