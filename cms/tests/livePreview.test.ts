import { Text } from "@codemirror/state";
import { GFM, parser } from "@lezer/markdown";
import { describe, expect, it } from "vitest";

import { frontmatterRange } from "../ui/src/frontmatter";
import {
  buildLivePreview,
  type LivePreviewSpecs,
  type Range,
} from "../ui/src/editor/livePreview";

const markdownParser = parser.configure(GFM);

function preview(
  source: string,
  selections: Range[] = [{ from: source.length, to: source.length }],
): LivePreviewSpecs {
  return buildLivePreview({
    text: Text.of(source.split("\n")),
    tree: markdownParser.parse(source),
    selections,
    frontmatter: frontmatterRange(source),
  });
}

function without(source: string, ranges: Range[]): string {
  let result = "";
  let position = 0;
  for (const range of [...ranges].sort((a, b) => a.from - b.from)) {
    result += source.slice(position, range.from);
    position = range.to;
  }
  return result + source.slice(position);
}

function lineClasses(specs: LivePreviewSpecs): string[] {
  return specs.lines.map((line) => line.className);
}

describe("buildLivePreview", () => {
  it("styles headings and hides their markers away from the caret", () => {
    const source = "# Title\n\nbody\n";
    const specs = preview(source);

    expect(specs.lines).toContainEqual({ from: 0, to: 7, className: "cm-md-h1" });
    expect(specs.hides).toContainEqual({ from: 0, to: 2 });
    expect(without(source, specs.hides)).toBe("Title\n\nbody\n");
  });

  it("reveals the raw heading when the caret is on its line", () => {
    const source = "# Title\n\nbody\n";
    const specs = preview(source, [{ from: 0, to: 0 }]);

    expect(specs.hides).toEqual([]);
    expect(specs.lines).toContainEqual({ from: 0, to: 7, className: "cm-md-h1" });
  });

  it("styles emphasis, strong, inline code, and strikethrough", () => {
    const source = "**strong** *em* `code` ~~strike~~\n\nbody\n";
    const specs = preview(source);

    expect(specs.marks).toEqual(
      expect.arrayContaining([
        { from: 2, to: 8, className: "cm-md-strong" },
        { from: 12, to: 14, className: "cm-md-emphasis" },
        { from: 17, to: 21, className: "cm-md-code-inline" },
        { from: 25, to: 31, className: "cm-md-strike" },
      ]),
    );
    expect(without(source, specs.hides)).toBe("strong em code strike\n\nbody\n");
  });

  it("hides link syntax but keeps the link text styled", () => {
    const source = '[link](https://example.test "title")\n\nbody\n';
    const specs = preview(source);

    expect(specs.marks).toContainEqual({ from: 1, to: 5, className: "cm-md-link" });
    expect(without(source, specs.hides)).toBe("link\n\nbody\n");
  });

  it("replaces images with a safe preview widget away from the caret", () => {
    const source = "![alt](/images/a.png)\n\nbody\n";
    const specs = preview(source);

    expect(specs.images).toEqual([
      {
        from: 0,
        to: 21,
        src: "https://raw.githubusercontent.com/tanabe1478/blog/main/Resources/images/a.png",
        alt: "alt",
      },
    ]);
    expect(without(source, specs.hides)).toBe("![alt](/images/a.png)\n\nbody\n");
  });

  it("keeps image source visible when the caret is on its line", () => {
    const specs = preview("![alt](/images/a.png)\n\nbody\n", [{ from: 2, to: 2 }]);
    expect(specs.images).toEqual([]);
  });

  it("keeps unsafe image URLs as source", () => {
    expect(preview("![alt](http://example.test/a.png)\n").images).toEqual([]);
    expect(preview("![alt](relative.png)\n").images).toEqual([]);
  });

  it("styles fenced code and badges mermaid without rendering it", () => {
    const source = "```mermaid\ngraph TD;\n```\n";
    const specs = preview(source);

    expect(lineClasses(specs)).toEqual(
      expect.arrayContaining(["cm-md-code-block cm-md-mermaid"]),
    );
    expect(specs.badges).toContainEqual({
      pos: 10,
      text: "mermaid",
      className: "cm-md-badge cm-md-badge-mermaid",
    });
    expect(specs.images).toEqual([]);
  });

  it("styles blockquotes and keeps list markers visible but dimmed", () => {
    const source = "> quote\n\n- one\n- two\n";
    const specs = preview(source);

    expect(specs.lines).toEqual(
      expect.arrayContaining([
        { from: 0, to: 7, className: "cm-md-quote" },
        { from: 9, to: 14, className: "cm-md-list" },
        { from: 15, to: 20, className: "cm-md-list" },
      ]),
    );
    expect(specs.hides).toContainEqual({ from: 0, to: 2 });
    expect(specs.marks).toEqual(
      expect.arrayContaining([
        { from: 9, to: 10, className: "cm-md-list-mark" },
        { from: 15, to: 16, className: "cm-md-list-mark" },
      ]),
    );
  });

  it("keeps frontmatter out of Markdown parsing and styles it as a block", () => {
    const source = "---\ntitle: A\n---\n\n# H\n\nbody\n";
    const specs = preview(source);

    expect(specs.lines.filter((line) => line.className.includes("cm-md-frontmatter"))).toHaveLength(3);
    expect(specs.lines.some((line) => line.className.includes("cm-md-hr"))).toBe(false);
    expect(specs.lines).toContainEqual({ from: 18, to: 21, className: "cm-md-h1" });
    expect(specs.hides).toContainEqual({ from: 18, to: 20 });
  });

  it("leaves tables and raw HTML as source", () => {
    const source = "| a | b |\n| - | - |\n\n<div>x</div>\n";
    const specs = preview(source);

    expect(specs.hides).toEqual([]);
    expect(specs.lines.filter((line) => line.className.includes("cm-md-table"))).toHaveLength(2);
    expect(specs.lines.filter((line) => line.className.includes("cm-md-html"))).toHaveLength(1);
  });

  it("badges youtube directives and does not hide the blockquote marker", () => {
    const source = "> youtube https://youtu.be/x\n";
    const specs = preview(source, [{ from: 0, to: 0 }]);

    expect(specs.badges).toContainEqual({
      pos: 28,
      text: "YouTube",
      className: "cm-md-badge cm-md-badge-youtube",
    });
    expect(specs.lines).toContainEqual({
      from: 0,
      to: 28,
      className: "cm-md-youtube cm-md-quote",
    });
    expect(specs.hides).toEqual([]);
  });

  it("does not mistake a youtube line inside a fence for a directive", () => {
    const source = "```\n> youtube https://youtu.be/x\n```\n";
    const specs = preview(source);

    expect(specs.badges.some((badge) => badge.text === "YouTube")).toBe(false);
  });

  it("reveals every line touched by a selection", () => {
    const source = "# H\n\n**bold**\n";
    const specs = preview(source, [{ from: 0, to: source.length }]);
    expect(specs.hides).toEqual([]);
  });

  it("never emits overlapping hide ranges", () => {
    const source = "***both*** and ~~strike *em*~~\n\nbody\n";
    const specs = preview(source);
    const sorted = [...specs.hides].sort((a, b) => a.from - b.from || a.to - b.to);

    for (let index = 1; index < sorted.length; index++) {
      expect(sorted[index].from).toBeGreaterThanOrEqual(sorted[index - 1].to);
    }
  });
});
