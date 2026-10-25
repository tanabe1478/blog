export interface SelectionRange {
  from: number;
  to: number;
}

// Keep the repository's existing image-insertion policy: put a blank line
// around the image only when the neighbouring text is not already at a line
// boundary.
export function insertBlockMarkdown(
  source: string,
  range: SelectionRange,
  markdown: string,
): { text: string; cursor: number } {
  const before = source.slice(0, range.from);
  const after = source.slice(range.to);
  const leading = before && !before.endsWith("\n") ? "\n" : "";
  const trailing = after && !after.startsWith("\n") ? "\n" : "";
  const text = `${leading}${markdown}${trailing}`;
  return { text, cursor: range.from + text.length };
}

// CodeMirror stores lines without separators and joins them again with
// `state.lineBreak`. Preserve CRLF files when they are consistently CRLF;
// mixed endings fall back to LF, matching the existing Markdown helpers.
export function detectLineSeparator(source: string): string {
  const crlf = source.includes("\r\n");
  const loneLf = /(^|[^\r])\n/.test(source);
  return crlf && !loneLf ? "\r\n" : "\n";
}
