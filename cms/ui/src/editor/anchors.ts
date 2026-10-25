import {
  StateEffect,
  StateField,
  type EditorState,
  type Transaction,
} from "@codemirror/state";

import { insertBlockMarkdown, type SelectionRange } from "./insert";

export type AnchorId = number;

interface Anchor {
  id: AnchorId;
  from: number;
  to: number;
}

interface AnchorState {
  next: AnchorId;
  current: Anchor | null;
}

const setAnchor = StateEffect.define<Anchor | null>();

// One upload runs at a time, so one outstanding anchor is enough. Mapping it
// through every document change is what keeps text typed during an upload.
export const anchorField = StateField.define<AnchorState>({
  create: () => ({ next: 1, current: null }),
  update(value, transaction) {
    let current = value.current;
    if (current && transaction.docChanged) {
      current = {
        id: current.id,
        from: transaction.changes.mapPos(current.from, 1),
        to: transaction.changes.mapPos(current.to, 1),
      };
    }
    for (const effect of transaction.effects) {
      if (effect.is(setAnchor)) current = effect.value;
    }
    return {
      next: current ? Math.max(value.next, current.id + 1) : value.next,
      current,
    };
  },
});

export function captureAnchorEffect(
  state: EditorState,
  position = state.selection.main.head,
): { id: AnchorId; effect: StateEffect<Anchor | null> } {
  const id = state.field(anchorField).next;
  const selection = state.selection.main;
  const insideSelection =
    position >= selection.from && position <= selection.to;
  return {
    id,
    effect: setAnchor.of({
      id,
      from: insideSelection ? selection.from : position,
      to: insideSelection ? selection.to : position,
    }),
  };
}

export function captureAnchorInState(
  state: EditorState,
): { id: AnchorId; state: EditorState } {
  const captured = captureAnchorEffect(state);
  return {
    id: captured.id,
    state: state.update({ effects: captured.effect }).state,
  };
}

export function insertAtAnchorTransaction(
  state: EditorState,
  id: AnchorId,
  markdown: string,
): { transaction: Transaction; text: string; usedAnchor: boolean } {
  const captured = state.field(anchorField).current;
  const usedAnchor = captured?.id === id;
  const range: SelectionRange = usedAnchor ? captured : state.selection.main;
  const { text, cursor } = insertBlockMarkdown(state.doc, range, markdown);
  const insert =
    state.lineBreak === "\n" ? text : text.replace(/\n/g, state.lineBreak);
  return {
    text,
    usedAnchor,
    transaction: state.update({
      changes: { from: range.from, to: range.to, insert },
      selection: { anchor: cursor },
      effects: setAnchor.of(null),
      scrollIntoView: true,
    }),
  };
}

export function insertAtAnchorInState(
  state: EditorState,
  id: AnchorId,
  markdown: string,
): { state: EditorState; text: string; usedAnchor: boolean } {
  const result = insertAtAnchorTransaction(state, id, markdown);
  return {
    text: result.text,
    usedAnchor: result.usedAnchor,
    state: result.transaction.state,
  };
}
