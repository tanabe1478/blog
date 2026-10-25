import { describe, expect, it } from "vitest";

import {
  detectLineSeparator,
  insertBlockMarkdown,
} from "../ui/src/editor/insert";
import { minimalChange } from "../ui/src/editor/textChange";

function apply(source: string, change: { from: number; to: number; insert: string }): string {
  return source.slice(0, change.from) + change.insert + source.slice(change.to);
}

describe("minimalChange", () => {
  it("returns an empty change for identical text", () => {
    expect(minimalChange("same\n", "same\n")).toEqual({ from: 0, to: 0, insert: "" });
  });

  it("applies inserts, deletes, and replacements", () => {
    const cases = [
      ["abc", "abXc"],
      ["abc", "ac"],
      ["abc", "aXc"],
      ["", "new"],
      ["old", ""],
      ["same prefix and suffix", "same PREFIX and suffix"],
    ] as const;

    for (const [before, after] of cases) {
      expect(apply(before, minimalChange(before, after))).toBe(after);
    }
  });

  it("keeps repeated characters and CRLF intact", () => {
    const before = "---\r\ntitle: A\r\n---\r\n\r\n> quote\r\n";
    const after = "---\r\ntitle: A\r\npinned: true\r\n---\r\n\r\n> quote\r\n";
    expect(apply(before, minimalChange(before, after))).toBe(after);
  });
});

describe("insertBlockMarkdown", () => {
  it("inserts at the end of a document without adding a trailing newline", () => {
    expect(insertBlockMarkdown("body", { from: 4, to: 4 }, "![x](/images/x.png)")).toEqual({
      text: "\n![x](/images/x.png)",
      cursor: 24,
    });
  });

  it("adds surrounding newlines when the selection is inside a line", () => {
    const source = "before after";
    const result = insertBlockMarkdown(source, { from: 7, to: 7 }, "![x](/images/x.png)");
    const next = source.slice(0, 7) + result.text + source.slice(7);
    expect(next).toBe("before \n![x](/images/x.png)\nafter");
    expect(result.cursor).toBe(7 + result.text.length);
  });

  it("replaces a selection", () => {
    const source = "before old after";
    const result = insertBlockMarkdown(source, { from: 7, to: 10 }, "new");
    expect(source.slice(0, 7) + result.text + source.slice(10)).toBe("before \nnew\n after");
  });

  it("does not add a leading newline at the start of the document", () => {
    expect(insertBlockMarkdown("", { from: 0, to: 0 }, "image").text).toBe("image");
  });
});

describe("detectLineSeparator", () => {
  it("preserves consistent CRLF and defaults to LF", () => {
    expect(detectLineSeparator("a\r\nb\r\n")).toBe("\r\n");
    expect(detectLineSeparator("a\nb\n")).toBe("\n");
    expect(detectLineSeparator("a\r\nb\n")).toBe("\n");
    expect(detectLineSeparator("")).toBe("\n");
  });
});
