// Small helpers for editing the frontmatter and leading heading of a Markdown page.
// They work on lines instead of a YAML parser because moonbit-ssg only reads
// flat `key: value` lines, and keeping every untouched line avoids noisy diffs.

import { stringOffsetToDoc } from "./textPosition";

const fence = "---";

type Parts = { lines: string[] | null; rest: string; eol: string };

export function lineEndingOf(source: string): "\r\n" | "\n" {
  const crlf = source.includes("\r\n");
  const loneLf = /(^|[^\r])\n/.test(source);
  return crlf && !loneLf ? "\r\n" : "\n";
}

function splitFrontmatter(source: string): Parts {
  const eol = lineEndingOf(source);
  if (!source.startsWith(`${fence}${eol}`)) return { lines: null, rest: source, eol };
  const end = source.indexOf(`${eol}${fence}`, fence.length);
  if (end === -1) return { lines: null, rest: source, eol };
  const afterFence = end + fence.length + eol.length;
  if (afterFence < source.length && !source.startsWith(eol, afterFence)) {
    return { lines: null, rest: source, eol };
  }
  const body = source.slice(fence.length + eol.length, end);
  return {
    lines: body === "" ? [] : body.split(eol),
    rest: source.slice(Math.min(afterFence + eol.length, source.length)),
    eol,
  };
}

function joinFrontmatter(lines: string[], rest: string, eol: string): string {
  if (lines.length === 0) return rest;
  return `${fence}${eol}${lines.join(eol)}${eol}${fence}${eol}${rest}`;
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

// Half-open CodeMirror position of the leading `--- ... ---` block, including
// its final newline. The editor uses this to keep frontmatter out of Markdown
// parsing even when the file uses CRLF.
export function frontmatterRange(source: string): { from: number; to: number } | null {
  const { lines, rest, eol } = splitFrontmatter(source);
  if (lines === null) return null;
  return {
    from: 0,
    to: stringOffsetToDoc(source, source.length - rest.length, eol),
  };
}

export function readFrontmatterValue(source: string, key: string): string {
  const { lines } = splitFrontmatter(source);
  const line = lines?.find((candidate) => keyOf(candidate) === key);
  if (!line) return "";
  return unquote(line.slice(line.indexOf(":") + 1).trim());
}

// Replaces, appends or (with null) removes one key, leaving every other line as is.
export function setFrontmatterValue(source: string, key: string, value: string | null): string {
  const { lines, rest, eol } = splitFrontmatter(source);
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
  return joinFrontmatter(next, rest, eol);
}

type HeadingParts = { prefix: string; heading: string | null; body: string; eol: string };

function splitHeadingParts(source: string): HeadingParts {
  const { lines, rest, eol } = splitFrontmatter(source);
  const frontmatter = lines === null ? "" : source.slice(0, source.length - rest.length);
  const blank = /^(?:\r?\n)*/.exec(rest)?.[0] ?? "";
  const afterBlank = rest.slice(blank.length);
  const match = /^#(?: (.*))?(?:\r?\n|$)/.exec(afterBlank);
  if (!match) return { prefix: frontmatter + blank, heading: null, body: afterBlank, eol };
  return {
    prefix: frontmatter + blank,
    heading: (match[1] ?? "").trim(),
    body: afterBlank.slice(match[0].length).replace(/^(?:\r?\n)+/, ""),
    eol,
  };
}

// The page title is the first `# heading` after the frontmatter; the rest is the body.
export function splitHeading(source: string): { heading: string; body: string } {
  const { heading, body } = splitHeadingParts(source);
  return { heading: heading ?? "", body };
}

export function joinHeading(source: string, heading: string, body: string): string {
  const { prefix, eol } = splitHeadingParts(source);
  return `${prefix}# ${heading.trim()}${eol}${eol}${body}`;
}

// Start of the editable body: after frontmatter, blank lines, and a leading
// `# heading`. Used to place the caret when entering edit mode.
export function bodyStart(source: string): number {
  const { rest, eol } = splitFrontmatter(source);
  const prefix = source.length - rest.length;
  const blank = /^(?:\r?\n)*/.exec(rest)?.[0].length ?? 0;
  const afterBlank = rest.slice(blank);
  const heading = /^#(?: (.*))?(?:\r?\n|$)/.exec(afterBlank);
  let position = prefix + blank + (heading ? heading[0].length : 0);
  while (position < source.length && (source[position] === "\n" || source[position] === "\r")) {
    position++;
  }
  return stringOffsetToDoc(source, position, eol);
}
