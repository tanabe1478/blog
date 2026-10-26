import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import {
  EditorState,
  Text,
  type Extension,
  type Transaction,
} from "@codemirror/state";
import { describe, expect, it } from "vitest";

import {
  frontmatterProtection,
  markdownInput,
  pasteUrlAsLink,
  runInputCommand,
  type InputCommand,
  type MarkdownInputConfig,
} from "../ui/src/editor/inputAssist";

const withFrontmatter: MarkdownInputConfig = { hasFrontmatter: true };
const bodyOnly: MarkdownInputConfig = { hasFrontmatter: false };

interface StateOptions {
  anchor?: number;
  head?: number;
  readOnly?: boolean;
  lineSeparator?: string;
}

function createState(doc: string, options: StateOptions = {}): EditorState {
  const extensions: Extension[] = [
    markdown({ base: markdownLanguage, addKeymap: false, pasteURLAsLink: false }),
  ];
  if (options.lineSeparator) {
    extensions.push(EditorState.lineSeparator.of(options.lineSeparator));
  }
  if (options.readOnly) {
    extensions.push(EditorState.readOnly.of(true));
  }
  const text = Text.of(doc.split(options.lineSeparator ?? /\r\n?|\n/));
  const anchor = options.anchor ?? text.length;
  const state = EditorState.create({
    doc: text,
    selection: { anchor, head: options.head ?? anchor },
    extensions,
  });
  ensureSyntaxTree(state, state.doc.length, 1000);
  return state;
}

function run(
  state: EditorState,
  command: InputCommand,
  config: MarkdownInputConfig = withFrontmatter,
): Transaction | null {
  return runInputCommand(state, command, config);
}

function applied(transaction: Transaction | null): EditorState {
  if (!transaction) throw new Error("expected a transaction");
  return transaction.state;
}

function selectionRange(doc: string, needle: string, config: MarkdownInputConfig = withFrontmatter) {
  const from = doc.indexOf(needle);
  if (from < 0) throw new Error(`missing ${needle}`);
  return createState(doc, { anchor: from, head: from + needle.length });
}

describe("Markdown list and quote continuation", () => {
  it("continues unordered lists", () => {
    const transaction = run(createState("- hogehoge"), "continueMarkup");
    expect(applied(transaction).sliceDoc()).toBe("- hogehoge\n- ");
    expect(applied(transaction).selection.main.head).toBe("- hogehoge\n- ".length);
    expect(transaction?.isUserEvent("input")).toBe(true);
  });

  it("continues ordered lists", () => {
    expect(applied(run(createState("1. one"), "continueMarkup")).sliceDoc()).toBe(
      "1. one\n2. ",
    );
  });

  it("continues task lists", () => {
    expect(
      applied(run(createState("- [ ] task"), "continueMarkup")).sliceDoc(),
    ).toBe("- [ ] task\n- [ ] ");
  });

  it("continues a checked task as an unchecked task", () => {
    expect(
      applied(run(createState("- [x] done"), "continueMarkup")).sliceDoc(),
    ).toBe("- [x] done\n- [ ] ");
  });

  it("continues blockquotes", () => {
    expect(applied(run(createState("> quote"), "continueMarkup")).sliceDoc()).toBe(
      "> quote\n> ",
    );
  });

  it("exits an empty list item in one Enter", () => {
    expect(applied(run(createState("- "), "continueMarkup")).sliceDoc()).toBe("");
    expect(applied(run(createState("- a\n- "), "continueMarkup")).sliceDoc()).toBe(
      "- a\n",
    );
  });

  it("exits an empty blockquote in one Enter", () => {
    const transaction = run(createState("> quote\n> "), "continueMarkup");
    expect(applied(transaction).sliceDoc()).toBe("> quote\n");
    expect(applied(transaction).selection.main.head).toBe("> quote\n".length);
  });

  it("deletes list and quote markup on Backspace", () => {
    expect(applied(run(createState("- ", { anchor: 2 }), "deleteMarkup")).sliceDoc()).toBe(
      "",
    );
    expect(
      applied(run(createState("- foo", { anchor: 2 }), "deleteMarkup")).sliceDoc(),
    ).toBe("foo");
    expect(
      applied(run(createState("> foo", { anchor: 2 }), "deleteMarkup")).sliceDoc(),
    ).toBe("foo");
  });
});

describe("Markdown list indentation", () => {
  it("indents and outdents a list line by two spaces", () => {
    expect(applied(run(createState("- one"), "indentList")).sliceDoc()).toBe(
      "  - one",
    );
    expect(applied(run(createState("  - one"), "outdentList")).sliceDoc()).toBe(
      "- one",
    );
    expect(applied(run(createState("1. one"), "indentList")).sliceDoc()).toBe(
      "  1. one",
    );
  });

  it("applies indentation to every selected list line", () => {
    const source = "- one\n- two";
    const transaction = run(
      createState(source, { anchor: 0, head: source.length }),
      "indentList",
    );
    expect(applied(transaction).sliceDoc()).toBe("  - one\n  - two");
    expect(transaction?.isUserEvent("input.indent")).toBe(true);
  });

  it("outdents every selected list line", () => {
    const source = "  - one\n  - two";
    const transaction = run(
      createState(source, { anchor: 0, head: source.length }),
      "outdentList",
    );
    expect(applied(transaction).sliceDoc()).toBe("- one\n- two");
    expect(transaction?.isUserEvent("input.outdent")).toBe(true);
  });

  it("declines outside a list", () => {
    expect(run(createState("paragraph"), "indentList")).toBeNull();
    expect(run(createState("paragraph"), "outdentList")).toBeNull();
  });

  it("declines inside frontmatter and fenced code", () => {
    const frontmatter = "---\ntags:\n  - foo\n---\nbody\n";
    expect(
      run(
        createState(frontmatter, { anchor: frontmatter.indexOf("foo") }),
        "indentList",
      ),
    ).toBeNull();

    const fenced = "```\n- item\n```\n";
    expect(
      run(createState(fenced, { anchor: fenced.indexOf("item") }), "indentList"),
    ).toBeNull();
  });
});

describe("inline formatting toggles", () => {
  it("wraps and unwraps bold around a selection", () => {
    const wrapped = run(selectionRange("word", "word"), "bold");
    expect(applied(wrapped).sliceDoc()).toBe("**word**");
    expect(wrapped?.state.selection.main.anchor).toBe(2);
    expect(wrapped?.state.selection.main.head).toBe(6);
    expect(wrapped?.isUserEvent("input.format.bold")).toBe(true);

    expect(
      applied(run(selectionRange("**word**", "**word**"), "bold")).sliceDoc(),
    ).toBe("word");
    expect(
      applied(run(selectionRange("**word**", "word"), "bold")).sliceDoc(),
    ).toBe("word");
  });

  it("wraps and unwraps italic and strike", () => {
    expect(applied(run(selectionRange("word", "word"), "italic")).sliceDoc()).toBe(
      "*word*",
    );
    expect(
      applied(run(selectionRange("*word*", "word"), "italic")).sliceDoc(),
    ).toBe("word");
    expect(applied(run(selectionRange("word", "word"), "strike")).sliceDoc()).toBe(
      "~~word~~",
    );
    expect(
      applied(run(selectionRange("~~word~~", "word"), "strike")).sliceDoc(),
    ).toBe("word");
  });

  it("inserts a pair at an empty cursor and keeps the cursor inside", () => {
    const transaction = run(createState("", { anchor: 0 }), "bold");
    expect(applied(transaction).sliceDoc()).toBe("****");
    expect(applied(transaction).selection.main.head).toBe(2);
  });

  it("wraps inline code and chooses a longer fence for inner backticks", () => {
    expect(
      applied(run(selectionRange("word", "word"), "inlineCode")).sliceDoc(),
    ).toBe("`word`");
    expect(
      applied(run(selectionRange("a `b` c", "a `b` c"), "inlineCode")).sliceDoc(),
    ).toBe("``a `b` c``");
  });

  it("unwraps inline code", () => {
    expect(
      applied(run(selectionRange("`word`", "`word`"), "inlineCode")).sliceDoc(),
    ).toBe("word");
    expect(
      applied(run(selectionRange("`word`", "word"), "inlineCode")).sliceDoc(),
    ).toBe("word");
  });

  it("does not nest a second inline code span", () => {
    const state = createState("`word`", { anchor: 3 });
    const transaction = run(state, "inlineCode");
    expect(transaction).not.toBeNull();
    expect(applied(transaction).sliceDoc()).toBe("`word`");
  });

  it("blocks formatting in frontmatter, code, tables, and inline code", () => {
    const frontmatter = "---\ntitle: word\n---\nbody\n";
    const frontmatterState = selectionRange(frontmatter, "word");
    const frontmatterTransaction = run(frontmatterState, "bold");
    expect(frontmatterTransaction).not.toBeNull();
    expect(applied(frontmatterTransaction).sliceDoc()).toBe(frontmatter);

    const fenced = "```\nword\n```\n";
    const fencedTransaction = run(selectionRange(fenced, "word"), "bold");
    expect(fencedTransaction).not.toBeNull();
    expect(applied(fencedTransaction).sliceDoc()).toBe(fenced);

    const table = "| a | b |\n| --- | --- |\n| word | x |\n";
    const tableTransaction = run(selectionRange(table, "word"), "bold");
    expect(tableTransaction).not.toBeNull();
    expect(applied(tableTransaction).sliceDoc()).toBe(table);

    const code = "`word`";
    const codeTransaction = run(selectionRange(code, "word"), "bold");
    expect(codeTransaction).not.toBeNull();
    expect(applied(codeTransaction).sliceDoc()).toBe(code);
  });

  it("allows formatting inside a link label", () => {
    expect(
      applied(run(selectionRange("[word](https://x.test)", "word"), "bold"))
        .sliceDoc(),
    ).toBe("[**word**](https://x.test)");
  });
});

describe("links", () => {
  it("wraps a selection and puts the cursor between the parentheses", () => {
    const transaction = run(selectionRange("word", "word"), "link");
    expect(applied(transaction).sliceDoc()).toBe("[word]()");
    expect(applied(transaction).selection.main.head).toBe(7);
    expect(transaction?.isUserEvent("input.format.link")).toBe(true);
  });

  it("inserts an empty link pair at the cursor", () => {
    const transaction = run(createState("text", { anchor: 4 }), "link");
    expect(applied(transaction).sliceDoc()).toBe("text[]()");
    expect(applied(transaction).selection.main.head).toBe(5);
  });

  it("declines inside an existing link and across lines", () => {
    const link = "[word](https://x.test)";
    const linkTransaction = run(selectionRange(link, "word"), "link");
    expect(linkTransaction).not.toBeNull();
    expect(applied(linkTransaction).sliceDoc()).toBe(link);

    const multiline = "one\ntwo";
    const multilineTransaction = run(
      createState(multiline, { anchor: 0, head: multiline.length }),
      "link",
    );
    expect(multilineTransaction).not.toBeNull();
    expect(applied(multilineTransaction).sliceDoc()).toBe(multiline);
  });

  it("declines in fenced code", () => {
    const fenced = "```\nword\n```\n";
    const transaction = run(selectionRange(fenced, "word"), "link");
    expect(transaction).not.toBeNull();
    expect(applied(transaction).sliceDoc()).toBe(fenced);
  });
});

describe("frontmatter protection", () => {
  it("does not continue a YAML list line", () => {
    const source = "---\ntags:\n  - foo\n---\nbody\n";
    expect(
      run(createState(source, { anchor: source.indexOf("foo") }), "continueMarkup"),
    ).toBeNull();
  });

  it("treats formatting and links as no-ops in frontmatter", () => {
    const source = "---\ntitle: word\n---\nbody\n";
    const state = selectionRange(source, "word");
    expect(applied(run(state, "bold")).sliceDoc()).toBe(source);
    expect(applied(run(state, "link")).sliceDoc()).toBe(source);
  });

  it("protects a document with an unterminated frontmatter fence", () => {
    const source = "---\ntitle: word\n";
    const state = createState(source, { anchor: source.indexOf("word") });
    expect(frontmatterProtection(state, withFrontmatter)).toEqual({
      from: 0,
      to: source.length,
    });
  });

  it("does not treat a body-only document as frontmatter", () => {
    const source = "---\n\nfoo\n\n---\n";
    expect(frontmatterProtection(createState(source), bodyOnly)).toBeNull();
    expect(
      applied(run(selectionRange(source, "foo", bodyOnly), "bold", bodyOnly))
        .sliceDoc(),
    ).toBe("---\n\n**foo**\n\n---\n");
  });
});

describe("read-only guard", () => {
  it("declines line commands and consumes formatting", () => {
    const source = "- item";
    const state = createState(source, { readOnly: true });
    expect(run(state, "continueMarkup")).toBeNull();
    expect(run(state, "deleteMarkup")).toBeNull();
    expect(run(state, "indentList")).toBeNull();

    const transaction = run(state, "bold");
    expect(transaction).not.toBeNull();
    expect(applied(transaction).sliceDoc()).toBe(source);
  });
});

describe("CRLF documents", () => {
  it("inserts the configured line separator when continuing a list", () => {
    const state = createState("- a\r\n", {
      lineSeparator: "\r\n",
      anchor: 3,
    });
    const transaction = run(state, "continueMarkup");
    const next = applied(transaction);
    expect(next.sliceDoc()).toBe("- a\r\n- \r\n");
    expect(next.selection.main.head).toBe(next.doc.line(2).to);
  });

  it("exits an empty blockquote without changing line endings", () => {
    const state = createState("> a\r\n> ", { lineSeparator: "\r\n" });
    expect(applied(run(state, "continueMarkup")).sliceDoc()).toBe("> a\r\n");
  });

  it("preserves line endings when formatting", () => {
    const source = "first\r\nsecond\r\n";
    const transaction = run(
      createState(source, {
        anchor: 6,
        head: 12,
        lineSeparator: "\r\n",
      }),
      "bold",
    );
    expect(applied(transaction).sliceDoc()).toBe("first\r\n**second**\r\n");
  });
});

describe("URL paste", () => {
  it("turns a URL paste into a link", () => {
    const transaction = pasteUrlAsLink(
      selectionRange("word", "word"),
      "https://example.test",
      withFrontmatter,
    );
    expect(applied(transaction).sliceDoc()).toBe("[word](https://example.test)");
    expect(transaction?.isUserEvent("input.paste")).toBe(true);
  });

  it("adds the https scheme to www URLs", () => {
    const transaction = pasteUrlAsLink(
      selectionRange("word", "word"),
      "www.example.test",
      withFrontmatter,
    );
    expect(applied(transaction).sliceDoc()).toBe("[word](https://www.example.test)");
  });

  it("accepts the native URL schemes", () => {
    for (const url of [
      "http://example.test",
      "https://example.test",
      "mailto:me@example.test",
      "xmpp:me@example.test",
    ]) {
      const transaction = pasteUrlAsLink(
        selectionRange("word", "word"),
        url,
        withFrontmatter,
      );
      expect(applied(transaction).sliceDoc()).toBe(`[word](${url})`);
    }
  });

  it("declines an empty selection and non-URL text", () => {
    expect(
      pasteUrlAsLink(createState("word"), "https://example.test", withFrontmatter),
    ).toBeNull();
    expect(
      pasteUrlAsLink(
        selectionRange("word", "word"),
        "not a URL",
        withFrontmatter,
      ),
    ).toBeNull();
  });

  it("declines in frontmatter, read-only, fenced code, and across inline nodes", () => {
    const frontmatter = "---\ntitle: word\n---\nbody\n";
    expect(
      pasteUrlAsLink(
        selectionRange(frontmatter, "word"),
        "https://example.test",
        withFrontmatter,
      ),
    ).toBeNull();

    const readOnly = createState("word", {
      anchor: 0,
      head: 4,
      readOnly: true,
    });
    expect(
      pasteUrlAsLink(readOnly, "https://example.test", withFrontmatter),
    ).toBeNull();

    const fenced = "```\nword\n```\n";
    expect(
      pasteUrlAsLink(
        selectionRange(fenced, "word"),
        "https://example.test",
        withFrontmatter,
      ),
    ).toBeNull();

    const strong = "a **bold** b";
    expect(
      pasteUrlAsLink(
        createState(strong, { anchor: 0, head: strong.length }),
        "https://example.test",
        withFrontmatter,
      ),
    ).toBeNull();
  });
});

describe("markdownInput extension", () => {
  it("returns an extension", () => {
    expect(markdownInput({ hasFrontmatter: true })).toBeDefined();
  });
});
