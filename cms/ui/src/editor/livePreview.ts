import type { SyntaxNode, Tree } from "@lezer/common";
import type { Text } from "@codemirror/state";

import { previewImageUrl } from "../previewUrl";

export interface Range {
  from: number;
  to: number;
}

export interface MarkSpec extends Range {
  className: string;
}

export interface LineSpec extends Range {
  className: string;
}

export interface ImageSpec extends Range {
  src: string;
  alt: string;
}

export interface BadgeSpec {
  pos: number;
  text: string;
  className: string;
}

export interface LivePreviewSpecs {
  hides: Range[];
  marks: MarkSpec[];
  lines: LineSpec[];
  images: ImageSpec[];
  badges: BadgeSpec[];
}

export interface LivePreviewInput {
  text: Text;
  tree: Tree;
  selections: readonly Range[];
  frontmatter: Range | null;
}

const IMAGE_RE = /^!\[([\s\S]*?)\]\((\S+?)(?:\s+["'][^"']*["'])?\)$/;
const YOUTUBE_RE = /^\s*>\s*youtube\s+\S+/;

function forEachLine(
  text: Text,
  from: number,
  to: number,
  visit: (line: { number: number; from: number; to: number }) => void,
): void {
  let pos = Math.max(0, Math.min(from, text.length));
  const last = Math.max(pos, Math.min(to > from ? to - 1 : to, text.length));
  while (true) {
    const line = text.lineAt(pos);
    visit(line);
    if (line.to >= last || line.to >= text.length) break;
    pos = line.to + 1;
  }
}

function activeLines(text: Text, selections: readonly Range[]): Set<number> {
  const active = new Set<number>();
  for (const selection of selections) {
    const from = Math.max(0, Math.min(selection.from, text.length));
    const to = Math.max(from, Math.min(selection.to, text.length));
    const last = to > from ? to - 1 : to;
    let pos = from;
    while (true) {
      const line = text.lineAt(pos);
      active.add(line.number);
      if (line.to >= last || line.to >= text.length) break;
      pos = line.to + 1;
    }
  }
  return active;
}

function scanYouTubeLines(text: Text, start: number): Set<number> {
  const found = new Set<number>();
  let fence: string | null = null;
  let pos = Math.max(0, start);

  while (pos <= text.length) {
    const line = text.lineAt(pos);
    const source = text.sliceString(line.from, line.to);
    const trimmed = source.trimStart();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      const marker = trimmed.slice(0, 3);
      if (fence === marker) fence = null;
      else if (fence === null) fence = marker;
    } else if (fence === null && YOUTUBE_RE.test(source)) {
      found.add(line.number);
    }
    if (line.to >= text.length) break;
    pos = line.to + 1;
  }
  return found;
}

function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length < 2) return ranges;
  const sorted = [...ranges].sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: Range[] = [sorted[0]];
  for (const range of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (range.from <= last.to) last.to = Math.max(last.to, range.to);
    else merged.push({ ...range });
  }
  return merged;
}

function childrenNamed(node: SyntaxNode, name: string): SyntaxNode[] {
  const found: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === name) found.push(child);
  }
  return found;
}

export function buildLivePreview(input: LivePreviewInput): LivePreviewSpecs {
  const { text, tree, selections, frontmatter } = input;
  const active = activeLines(text, selections);
  const hides: Range[] = [];
  const marks: MarkSpec[] = [];
  const images: ImageSpec[] = [];
  const badges: BadgeSpec[] = [];
  const lineClasses = new Map<number, Set<string>>();

  const addLine = (from: number, className: string) => {
    const line = text.lineAt(from);
    const classes = lineClasses.get(line.number) ?? new Set<string>();
    classes.add(className);
    lineClasses.set(line.number, classes);
  };

  const addLines = (from: number, to: number, className: string) => {
    forEachLine(text, from, to, (line) => addLine(line.from, className));
  };

  if (frontmatter) {
    forEachLine(text, 0, frontmatter.to, (line) => addLine(line.from, "cm-md-frontmatter"));
  }

  const youtubeLines = scanYouTubeLines(text, frontmatter?.to ?? 0);
  for (const lineNumber of youtubeLines) {
    const line = text.line(lineNumber);
    addLine(line.from, "cm-md-youtube");
    badges.push({
      pos: line.to,
      text: "YouTube",
      className: "cm-md-badge cm-md-badge-youtube",
    });
  }

  const isActive = (pos: number) => active.has(text.lineAt(pos).number);
  const start = frontmatter?.to ?? 0;

  const visit = (node: SyntaxNode): void => {
    if (node.to <= start) return;
    const { name, from, to } = node;
    if (from < start && name !== "Document") {
      for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
      return;
    }

    let skipChildren = false;
    switch (name) {
        case "ATXHeading1":
        case "ATXHeading2":
        case "ATXHeading3":
        case "ATXHeading4":
        case "ATXHeading5":
        case "ATXHeading6": {
          const level = name.slice(-1);
          addLines(from, to, `cm-md-h${level}`);
          break;
        }
        case "SetextHeading1":
        case "SetextHeading2": {
          const level = name.endsWith("1") ? "1" : "2";
          const line = text.lineAt(from);
          addLine(line.from, `cm-md-h${level}`);
          break;
        }
        case "HeaderMark": {
          if (!isActive(from)) {
            const space = text.sliceString(to, Math.min(to + 1, text.length)) === " " ? 1 : 0;
            hides.push({ from, to: to + space });
          }
          break;
        }
        case "StrongEmphasis":
        case "Emphasis":
        case "Strikethrough": {
          const marker = name === "Strikethrough" ? "StrikethroughMark" : "EmphasisMark";
          const delimiters = childrenNamed(node, marker);
          const className =
            name === "StrongEmphasis"
              ? "cm-md-strong"
              : name === "Emphasis"
                ? "cm-md-emphasis"
                : "cm-md-strike";
          if (delimiters.length >= 2) {
            const contentFrom = delimiters[0].to;
            const contentTo = delimiters[delimiters.length - 1].from;
            if (contentFrom < contentTo) marks.push({ from: contentFrom, to: contentTo, className });
          }
          if (!isActive(from)) {
            for (const delimiter of delimiters) {
              hides.push({ from: delimiter.from, to: delimiter.to });
            }
          }
          break;
        }
        case "InlineCode": {
          const delimiters = childrenNamed(node, "CodeMark");
          if (delimiters.length >= 2) {
            const contentFrom = delimiters[0].to;
            const contentTo = delimiters[delimiters.length - 1].from;
            if (contentFrom < contentTo) {
              marks.push({ from: contentFrom, to: contentTo, className: "cm-md-code-inline" });
            }
          }
          if (!isActive(from)) {
            for (const delimiter of delimiters) {
              hides.push({ from: delimiter.from, to: delimiter.to });
            }
          }
          break;
        }
        case "Link": {
          const delimiters = childrenNamed(node, "LinkMark");
          if (delimiters.length >= 2) {
            const contentFrom = delimiters[0].to;
            const contentTo = delimiters[1].from;
            if (contentFrom < contentTo) {
              marks.push({ from: contentFrom, to: contentTo, className: "cm-md-link" });
            }
            if (!isActive(from)) {
              hides.push({ from: delimiters[0].from, to: delimiters[0].to });
              hides.push({
                from: delimiters[1].from,
                to: delimiters[delimiters.length - 1].to,
              });
            }
          }
          break;
        }
        case "Image": {
          const match = IMAGE_RE.exec(text.sliceString(from, to));
          if (!isActive(from) && match) {
            const src = previewImageUrl(match[2]);
            if (src.startsWith("https://")) {
              images.push({ from, to, src, alt: match[1] });
            }
          }
          skipChildren = true;
          break;
        }
        case "FencedCode": {
          const info = childrenNamed(node, "CodeInfo")[0];
          const language = info ? text.sliceString(info.from, info.to).trim() : "";
          addLines(from, to, "cm-md-code-block");
          if (language === "mermaid") addLines(from, to, "cm-md-mermaid");
          const openingLine = text.lineAt(from);
          badges.push({
            pos: openingLine.to,
            text: language || "code",
            className:
              language === "mermaid"
                ? "cm-md-badge cm-md-badge-mermaid"
                : "cm-md-badge cm-md-badge-code",
          });
          break;
        }
        case "Blockquote": {
          addLines(from, to, "cm-md-quote");
          break;
        }
        case "QuoteMark": {
          const lineNumber = text.lineAt(from).number;
          if (!isActive(from) && !youtubeLines.has(lineNumber)) {
            const space = text.sliceString(to, Math.min(to + 1, text.length)) === " " ? 1 : 0;
            hides.push({ from, to: to + space });
          }
          break;
        }
        case "BulletList":
        case "OrderedList": {
          addLines(from, to, "cm-md-list");
          break;
        }
        case "ListMark": {
          marks.push({ from, to, className: "cm-md-list-mark" });
          break;
        }
        case "HorizontalRule": {
          addLines(from, to, "cm-md-hr");
          break;
        }
        case "HTMLBlock": {
          addLines(from, to, "cm-md-html");
          break;
        }
        case "Table": {
          addLines(from, to, "cm-md-table");
          break;
        }
        case "TaskMarker": {
          marks.push({ from, to, className: "cm-md-task-marker" });
          break;
        }
    }

    if (skipChildren) return;
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
  };

  visit(tree.topNode);

  const lines: LineSpec[] = [...lineClasses.entries()]
    .sort(([a], [b]) => a - b)
    .map(([lineNumber, classes]) => {
      const line = text.line(lineNumber);
      return {
        from: line.from,
        to: line.to,
        className: [...classes].join(" "),
      };
    });

  return {
    hides: mergeRanges(hides),
    marks,
    lines,
    images,
    badges,
  };
}
