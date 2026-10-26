import {
  deleteMarkupBackward,
  insertNewlineContinueMarkupCommand,
  markdownLanguage,
} from "@codemirror/lang-markdown";
import { syntaxTree } from "@codemirror/language";
import {
  Prec,
  type ChangeSpec,
  type EditorState,
  type Extension,
  type Line,
  type Transaction,
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  type KeyBinding,
} from "@codemirror/view";

import { frontmatterRange } from "../frontmatter";

export interface MarkdownInputConfig {
  hasFrontmatter: boolean;
}

export type InputCommand =
  | "continueMarkup"
  | "deleteMarkup"
  | "indentList"
  | "outdentList"
  | "bold"
  | "italic"
  | "strike"
  | "inlineCode"
  | "link";

type GuardAction = "allow" | "decline" | "consume";

interface ListItem {
  indent: number;
}

interface BlockContext {
  frontmatter: { from: number; to: number } | null;
  fencedCode: boolean;
  htmlBlock: boolean;
  table: boolean;
  horizontalRule: boolean;
  inlineCode: boolean;
  link: boolean;
}

interface TextPlan {
  changes: ChangeSpec | ChangeSpec[];
  selection?: { anchor: number; head?: number };
  userEvent: string;
  unwraps?: boolean;
}

const LIST_ITEM_RE = /^(\s*)(?:[-+*]|\d{1,9}[.)])(?:[ \t]+)(?:\[[ xX]\][ \t]+)?/;
const EMPTY_BLOCKQUOTE_RE = /^[ \t]*(?:>[ \t]*)+$/;
const URL_RE = /^(https?:\/\/|mailto:|xmpp:|www\.)/;
const NON_PLAIN_TEXT_RE =
  /code|horizontalrule|html|link|comment|processing|escape|entity|image|mark|url/i;

const FENCED_CODE_NODES = new Set(["FencedCode", "CodeBlock"]);
const HTML_BLOCK_NODES = new Set(["HTMLBlock"]);
const TABLE_NODES = new Set(["Table"]);
const HORIZONTAL_RULE_NODES = new Set(["HorizontalRule"]);
const INLINE_CODE_NODES = new Set(["InlineCode"]);
const LINK_NODES = new Set(["Link"]);
const BLOCKED_LINE_NODES = new Set([
  "FencedCode",
  "CodeBlock",
  "HTMLBlock",
  "Table",
  "HorizontalRule",
]);

const FORMAT_DELIMITERS = {
  bold: "**",
  italic: "*",
  strike: "~~",
} as const;

type DelimitedFormat = keyof typeof FORMAT_DELIMITERS;

const FORMAT_NODES: Record<DelimitedFormat, ReadonlySet<string>> = {
  bold: new Set(["StrongEmphasis"]),
  italic: new Set(["Emphasis"]),
  strike: new Set(["Strikethrough"]),
};

const FORMAT_EVENTS = {
  bold: "input.format.bold",
  italic: "input.format.italic",
  strike: "input.format.strike",
  inlineCode: "input.format.inlineCode",
  link: "input.format.link",
} as const;

function isFormatCommand(command: InputCommand): boolean {
  return (
    command === "bold" ||
    command === "italic" ||
    command === "strike" ||
    command === "inlineCode" ||
    command === "link"
  );
}

function rangeOverlaps(
  from: number,
  to: number,
  selectionFrom: number,
  selectionTo: number,
): boolean {
  if (selectionFrom === selectionTo) {
    return from <= selectionFrom && selectionFrom < to;
  }
  return from < selectionTo && to > selectionFrom;
}

// `frontmatterRange` only inspects the raw text. Body-only editors must not
// call it at all, because a body that happens to start and end with `---`
// looks like frontmatter. A document that opens with `---` but never closes
// the fence stays protected instead of leaking Markdown commands into YAML.
export function frontmatterProtection(
  state: EditorState,
  config: MarkdownInputConfig,
): { from: number; to: number } | null {
  if (!config.hasFrontmatter) return null;
  const source = state.sliceDoc();
  const range = frontmatterRange(source);
  if (range) return range;
  return /^---[ \t]*(?:\r\n|\n|$)/.test(source)
    ? { from: 0, to: state.doc.length }
    : null;
}

function hasNode(
  state: EditorState,
  from: number,
  to: number,
  names: ReadonlySet<string>,
): boolean {
  let found = false;
  syntaxTree(state).iterate({
    from,
    to,
    enter(node) {
      if (
        names.has(node.name) &&
        rangeOverlaps(node.from, node.to, from, to)
      ) {
        found = true;
      }
    },
  });
  return found;
}

function nodeInRangeOrLine(
  state: EditorState,
  from: number,
  to: number,
  names: ReadonlySet<string>,
): boolean {
  if (hasNode(state, from, to, names)) return true;
  const line = state.doc.lineAt(from);
  return hasNode(state, line.from, line.to, names);
}

function listItemFromLine(line: Line): ListItem | null {
  const match = LIST_ITEM_RE.exec(line.text);
  if (!match) return null;
  return { indent: match[1].length };
}

function blockContext(
  state: EditorState,
  config: MarkdownInputConfig,
): BlockContext {
  const selection = state.selection.main;
  const from = selection.from;
  const to = selection.to;
  return {
    frontmatter: frontmatterProtection(state, config),
    fencedCode: nodeInRangeOrLine(state, from, to, FENCED_CODE_NODES),
    htmlBlock: nodeInRangeOrLine(state, from, to, HTML_BLOCK_NODES),
    table: nodeInRangeOrLine(state, from, to, TABLE_NODES),
    horizontalRule: nodeInRangeOrLine(
      state,
      from,
      to,
      HORIZONTAL_RULE_NODES,
    ),
    // Formatting may wrap a selection that contains a code span, but not a
    // selection that starts or ends inside one.
    inlineCode:
      from === to
        ? hasNode(state, from, to, INLINE_CODE_NODES)
        : hasNode(state, from, from, INLINE_CODE_NODES) ||
          hasNode(state, to, to, INLINE_CODE_NODES),
    link: hasNode(state, from, to, LINK_NODES),
  };
}

function guardAction(
  state: EditorState,
  command: InputCommand,
  context: BlockContext,
  listTargets: number,
  unwraps: boolean,
): GuardAction {
  const selection = state.selection.main;
  if (
    context.frontmatter &&
    rangeOverlaps(
      context.frontmatter.from,
      context.frontmatter.to,
      selection.from,
      selection.to,
    )
  ) {
    return isFormatCommand(command) ? "consume" : "decline";
  }
  if (state.readOnly) {
    return isFormatCommand(command) ? "consume" : "decline";
  }

  switch (command) {
    case "continueMarkup":
    case "deleteMarkup":
      return context.fencedCode || context.htmlBlock || context.table
        ? "decline"
        : "allow";
    case "indentList":
    case "outdentList":
      if (context.fencedCode || context.htmlBlock || context.table) {
        return "decline";
      }
      return listTargets > 0 ? "allow" : "decline";
    case "bold":
    case "italic":
    case "strike":
      if (context.inlineCode) return "consume";
      if (
        context.fencedCode ||
        context.htmlBlock ||
        context.table ||
        context.horizontalRule
      ) {
        return unwraps && selection.empty ? "allow" : "consume";
      }
      return "allow";
    case "inlineCode":
      if (
        context.fencedCode ||
        context.htmlBlock ||
        context.table ||
        context.horizontalRule
      ) {
        return "consume";
      }
      // Unwrapping an existing span is the way out; only nesting a new pair
      // inside a code span is a no-op.
      return context.inlineCode && !unwraps ? "consume" : "allow";
    case "link":
      if (
        context.fencedCode ||
        context.htmlBlock ||
        context.table ||
        context.horizontalRule ||
        context.inlineCode ||
        context.link
      ) {
        return "consume";
      }
      if (
        selection.from !== selection.to &&
        state.doc.lineAt(selection.from).number !==
          state.doc.lineAt(selection.to).number
      ) {
        return "consume";
      }
      return "allow";
  }
}

function emptyBlockquoteExit(state: EditorState): Transaction | null {
  if (state.selection.ranges.length !== 1) return null;
  const selection = state.selection.main;
  if (!selection.empty) return null;
  const line = state.doc.lineAt(selection.head);
  if (!EMPTY_BLOCKQUOTE_RE.test(line.text)) return null;
  return state.update({
    changes: { from: line.from, to: line.to, insert: "" },
    selection: { anchor: line.from },
    scrollIntoView: true,
    userEvent: "input",
  });
}

function continueMarkup(state: EditorState): Transaction | null {
  const exit = emptyBlockquoteExit(state);
  if (exit) return exit;

  let captured: Transaction | null = null;
  const handled = insertNewlineContinueMarkupCommand({ nonTightLists: false })({
    state,
    dispatch(transaction) {
      captured = transaction;
    },
  });
  return handled ? captured : null;
}

function deleteMarkup(state: EditorState): Transaction | null {
  let captured: Transaction | null = null;
  const handled = deleteMarkupBackward({
    state,
    dispatch(transaction) {
      captured = transaction;
    },
  });
  return handled ? captured : null;
}

function selectedLines(state: EditorState): Line[] {
  const selection = state.selection.main;
  const doc = state.doc;
  const first = doc.lineAt(selection.from);
  const last = doc.lineAt(selection.to);
  const lastNumber =
    selection.to > selection.from && last.from === selection.to
      ? last.number - 1
      : last.number;
  const lines: Line[] = [];
  for (let number = first.number; number <= lastNumber; number += 1) {
    lines.push(doc.line(number));
  }
  return lines;
}

function listTargets(
  state: EditorState,
  config: MarkdownInputConfig,
): Array<{ line: Line; item: ListItem }> {
  const frontmatter = frontmatterProtection(state, config);
  const targets: Array<{ line: Line; item: ListItem }> = [];
  for (const line of selectedLines(state)) {
    const item = listItemFromLine(line);
    if (!item) continue;
    if (
      frontmatter &&
      rangeOverlaps(frontmatter.from, frontmatter.to, line.from, line.to)
    ) {
      continue;
    }
    if (hasNode(state, line.from, line.to, BLOCKED_LINE_NODES)) continue;
    targets.push({ line, item });
  }
  return targets;
}

function runListIndent(
  state: EditorState,
  command: "indentList" | "outdentList",
  config: MarkdownInputConfig,
): Transaction | null {
  const context = blockContext(state, config);
  const targets = listTargets(state, config);
  if (
    guardAction(state, command, context, targets.length, false) !== "allow"
  ) {
    return null;
  }

  const indent = command === "indentList";
  const changes: ChangeSpec[] = [];
  for (const { line, item } of targets) {
    if (indent) {
      changes.push({ from: line.from, insert: "  " });
      continue;
    }
    const remove = Math.min(2, item.indent);
    if (remove > 0) changes.push({ from: line.from, to: line.from + remove });
  }

  const userEvent = indent ? "input.indent" : "input.outdent";
  if (changes.length === 0) {
    return state.update({ userEvent });
  }
  return state.update({ changes, scrollIntoView: true, userEvent });
}

function selectedRange(main: { anchor: number; head: number }, from: number, to: number) {
  return main.anchor <= main.head
    ? { anchor: from, head: to }
    : { anchor: to, head: from };
}

function planDelimited(
  state: EditorState,
  format: DelimitedFormat,
  userEvent: string,
): TextPlan {
  const delimiter = FORMAT_DELIMITERS[format];
  const main = state.selection.main;
  const { from, to } = main;

  if (from === to) {
    const beforePair = state.doc.sliceString(
      Math.max(0, from - delimiter.length),
      from,
    );
    const afterPair = state.doc.sliceString(
      to,
      Math.min(state.doc.length, to + delimiter.length),
    );
    if (
      state.doc.length === delimiter.length * 2 &&
      beforePair === delimiter &&
      afterPair === delimiter
    ) {
      return {
        changes: { from: 0, to: state.doc.length },
        selection: { anchor: 0 },
        userEvent,
        unwraps: true,
      };
    }
    return {
      changes: { from, insert: delimiter + delimiter },
      selection: { anchor: from + delimiter.length },
      userEvent,
    };
  }

  const selected = state.doc.sliceString(from, to);
  const hasFormat = hasNode(state, from, to, FORMAT_NODES[format]);
  const selectedIsPair = selected === delimiter.repeat(2);
  if (
    (hasFormat || selectedIsPair) &&
    selected.length >= delimiter.length * 2 &&
    selected.startsWith(delimiter) &&
    selected.endsWith(delimiter)
  ) {
    return {
      changes: [
        { from, to: from + delimiter.length },
        { from: to - delimiter.length, to },
      ],
      selection: selectedRange(
        main,
        from,
        to - delimiter.length * 2,
      ),
      userEvent,
      unwraps: true,
    };
  }

  const before = state.doc.sliceString(
    Math.max(0, from - delimiter.length),
    from,
  );
  const after = state.doc.sliceString(
    to,
    Math.min(state.doc.length, to + delimiter.length),
  );
  if (hasFormat && before === delimiter && after === delimiter) {
    return {
      changes: [
        { from: from - delimiter.length, to: from },
        { from: to, to: to + delimiter.length },
      ],
      selection: selectedRange(
        main,
        from - delimiter.length,
        to - delimiter.length,
      ),
      userEvent,
      unwraps: true,
    };
  }

  return {
    changes: [
      { from, insert: delimiter },
      { from: to, insert: delimiter },
    ],
    selection: selectedRange(main, from + delimiter.length, to + delimiter.length),
    userEvent,
  };
}

function planInlineCode(state: EditorState): TextPlan {
  const userEvent = FORMAT_EVENTS.inlineCode;
  const main = state.selection.main;
  const { from, to } = main;

  if (from === to) {
    const beforePair = state.doc.sliceString(
      Math.max(0, from - 1),
      from,
    );
    const afterPair = state.doc.sliceString(
      to,
      Math.min(state.doc.length, to + 1),
    );
    if (
      state.doc.length === 2 &&
      beforePair === "`" &&
      afterPair === "`"
    ) {
      return {
        changes: { from: 0, to: state.doc.length },
        selection: { anchor: 0 },
        userEvent,
        unwraps: true,
      };
    }
    return {
      changes: { from, insert: "``" },
      selection: { anchor: from + 1 },
      userEvent,
    };
  }

  const selected = state.doc.sliceString(from, to);
  const leading = /^`+/.exec(selected)?.[0] ?? "";
  const trailing = /`+$/.exec(selected)?.[0] ?? "";
  if (leading.length > 0 && leading.length === trailing.length) {
    return {
      changes: [
        { from, to: from + leading.length },
        { from: to - trailing.length, to },
      ],
      selection: selectedRange(
        main,
        from,
        to - leading.length - trailing.length,
      ),
      userEvent,
      unwraps: true,
    };
  }

  const before =
    /`+$/.exec(state.doc.sliceString(0, from))?.[0] ?? "";
  const after =
    /^`+/.exec(state.doc.sliceString(to, state.doc.length))?.[0] ?? "";
  if (before.length > 0 && before.length === after.length) {
    return {
      changes: [
        { from: from - before.length, to: from },
        { from: to, to: to + after.length },
      ],
      selection: selectedRange(
        main,
        from - before.length,
        to - after.length,
      ),
      userEvent,
      unwraps: true,
    };
  }

  const runs = selected.match(/`+/g) ?? [];
  const longest = runs.reduce((length, run) => Math.max(length, run.length), 0);
  const fence = "`".repeat(longest + 1);
  return {
    changes: [
      { from, insert: fence },
      { from: to, insert: fence },
    ],
    selection: selectedRange(main, from + fence.length, to + fence.length),
    userEvent,
  };
}

function planLink(state: EditorState): TextPlan {
  const main = state.selection.main;
  const userEvent = FORMAT_EVENTS.link;
  if (main.from === main.to) {
    return {
      changes: { from: main.from, insert: "[]()" },
      selection: { anchor: main.from + 1 },
      userEvent,
    };
  }
  return {
    changes: [
      { from: main.from, insert: "[" },
      { from: main.to, insert: "]()" },
    ],
    selection: { anchor: main.to + 3 },
    userEvent,
  };
}

function planFor(state: EditorState, command: InputCommand): TextPlan {
  switch (command) {
    case "bold":
    case "italic":
    case "strike":
      return planDelimited(state, command, FORMAT_EVENTS[command]);
    case "inlineCode":
      return planInlineCode(state);
    case "link":
      return planLink(state);
    default:
      throw new Error(`not a formatting command: ${command}`);
  }
}

export function runInputCommand(
  state: EditorState,
  command: InputCommand,
  config: MarkdownInputConfig,
): Transaction | null {
  if (command === "indentList" || command === "outdentList") {
    return runListIndent(state, command, config);
  }

  const context = blockContext(state, config);

  if (command === "continueMarkup" || command === "deleteMarkup") {
    if (guardAction(state, command, context, 0, false) !== "allow") {
      return null;
    }
    return command === "continueMarkup"
      ? continueMarkup(state)
      : deleteMarkup(state);
  }

  const plan = planFor(state, command);
  const guard = guardAction(
    state,
    command,
    context,
    0,
    plan.unwraps === true,
  );
  if (guard === "consume") return state.update({});
  if (guard === "decline") return null;

  return state.update({
    changes: plan.changes,
    selection: plan.selection,
    scrollIntoView: true,
    userEvent: plan.userEvent,
  });
}

function crossesNode(state: EditorState, from: number, to: number): boolean {
  let crosses = false;
  syntaxTree(state).iterate({
    from,
    to,
    enter(node) {
      if (node.from > from || NON_PLAIN_TEXT_RE.test(node.name)) {
        crosses = true;
      }
    },
    leave(node) {
      if (node.to < to) crosses = true;
    },
  });
  return crosses;
}

export function pasteUrlAsLink(
  state: EditorState,
  text: string,
  config: MarkdownInputConfig,
): Transaction | null {
  const selection = state.selection.main;
  if (selection.empty) return null;
  if (!URL_RE.test(text)) return null;

  const context = blockContext(state, config);
  if (guardAction(state, "link", context, 0, false) !== "allow") {
    return null;
  }
  if (!markdownLanguage.isActiveAt(state, selection.from, 1)) return null;
  if (crossesNode(state, selection.from, selection.to)) return null;

  const url = text.startsWith("www.") ? `https://${text}` : text;
  return state.update({
    changes: [
      { from: selection.from, insert: "[" },
      { from: selection.to, insert: `](${url})` },
    ],
    userEvent: "input.paste",
    scrollIntoView: true,
  });
}

export function markdownInput(config: MarkdownInputConfig): Extension {
  const binding = (key: string, command: InputCommand): KeyBinding => ({
    key,
    run(view) {
      const transaction = runInputCommand(view.state, command, config);
      if (!transaction) return false;
      view.dispatch(transaction);
      return true;
    },
  });

  return [
    Prec.high(
      keymap.of([
        binding("Enter", "continueMarkup"),
        binding("Backspace", "deleteMarkup"),
        binding("Tab", "indentList"),
        binding("Shift-Tab", "outdentList"),
        binding("Mod-b", "bold"),
        binding("Mod-i", "italic"),
        binding("Mod-Shift-x", "strike"),
        binding("Alt-Shift-5", "strike"),
        binding("Mod-Shift-`", "inlineCode"),
        binding("Mod-k", "link"),
      ]),
    ),
    EditorView.domEventHandlers({
      paste(event, view) {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (!text) return false;
        const transaction = pasteUrlAsLink(view.state, text, config);
        if (!transaction) return false;
        view.dispatch(transaction);
        return true;
      },
    }),
  ];
}
