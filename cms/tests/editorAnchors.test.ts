import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import {
  anchorField,
  captureAnchorInState,
  insertAtAnchorInState,
} from "../ui/src/editor/anchors";

function stateWith(source: string, anchor: number): EditorState {
  return EditorState.create({
    doc: source,
    selection: { anchor },
    extensions: [anchorField],
  });
}

describe("editor upload anchors", () => {
  it("keeps the insertion point after text typed during an upload", () => {
    const initial = stateWith("before\nafter", 7);
    const captured = captureAnchorInState(initial);
    const typed = captured.state.update({
      changes: { from: 7, insert: "typed\n" },
    }).state;

    const inserted = insertAtAnchorInState(typed, captured.id, "![x](/images/x.png)");

    expect(inserted.usedAnchor).toBe(true);
    expect(inserted.state.sliceDoc()).toBe(
      "before\ntyped\n![x](/images/x.png)\nafter",
    );
  });

  it("replaces a captured selection and moves the caret after the image", () => {
    const initial = stateWith("before old after", 7);
    const selected = initial.update({ selection: { anchor: 7, head: 10 } }).state;
    const captured = captureAnchorInState(selected);
    const inserted = insertAtAnchorInState(captured.state, captured.id, "image");

    expect(inserted.state.sliceDoc()).toBe("before \nimage\n after");
    expect(inserted.state.selection.main.head).toBe(14);
  });

  it("falls back to the live selection when the anchor id is stale", () => {
    const initial = stateWith("one two", 3);
    const captured = captureAnchorInState(initial);
    const moved = captured.state.update({ selection: { anchor: 7 } }).state;

    const inserted = insertAtAnchorInState(moved, captured.id + 1, "image");

    expect(inserted.usedAnchor).toBe(false);
    expect(inserted.state.sliceDoc()).toBe("one two\nimage");
  });

  it("maps the anchor through deletions and consumes it after insertion", () => {
    const initial = stateWith("abcdef", 4);
    const captured = captureAnchorInState(initial);
    const deleted = captured.state.update({
      changes: { from: 0, to: 2, insert: "" },
    }).state;
    const inserted = insertAtAnchorInState(deleted, captured.id, "X");

    expect(inserted.state.sliceDoc()).toBe("cd\nX\nef");
    expect(insertAtAnchorInState(inserted.state, captured.id, "Y").usedAnchor).toBe(false);
  });
});
