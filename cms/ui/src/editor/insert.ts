import type { Text } from "@codemirror/state";

export interface SelectionRange {
  from: number;
  to: number;
}

// Keep the repository's existing image-insertion policy: put a blank line
// around the image only when the neighbouring text is not already at a line
// boundary. Use Text rather than a string so CRLF documents keep CodeMirror's
// position numbering.
export function insertBlockMarkdown(
  doc: Text,
  range: SelectionRange,
  markdown: string,
): { text: string; cursor: number } {
  const fromLine = doc.lineAt(range.from);
  const toLine = doc.lineAt(range.to);
  const leading = fromLine.from < range.from ? "\n" : "";
  const trailing = toLine.to > range.to ? "\n" : "";
  const block = markdown.replace(/\r\n?/g, "\n");
  const text = `${leading}${block}${trailing}`;
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
