import {
  defaultKeymap,
  history,
  historyKeymap,
  selectAll,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  Annotation,
  EditorState,
  type Compartment,
  type Extension,
} from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";

import { anchorField } from "./anchors";
import { detectLineSeparator } from "./insert";
import { livePreview, livePreviewAtomic } from "./livePreviewPlugin";

export const externalSync = Annotation.define<boolean>();

export function readOnlyExtensions(readOnly: boolean): Extension {
  return [
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
  ];
}

export interface EditorExtensionConfig {
  source: string;
  nonce: string;
  ariaLabel: string;
  readOnly: Compartment;
  isReadOnly: boolean;
  onChange: (value: string) => void;
  onFiles?: (files: File[], position: number) => void;
}

function droppedFiles(event: DragEvent): File[] {
  return Array.from(event.dataTransfer?.files ?? []);
}

export function createExtensions(config: EditorExtensionConfig): Extension[] {
  return [
    history(),
    keymap.of([{ key: "Mod-a", run: selectAll }, ...defaultKeymap, ...historyKeymap]),
    markdown({ base: markdownLanguage, addKeymap: false }),
    EditorView.lineWrapping,
    EditorState.lineSeparator.of(detectLineSeparator(config.source)),
    EditorView.contentAttributes.of({
      "aria-label": config.ariaLabel,
      "aria-multiline": "true",
      spellcheck: "false",
      autocapitalize: "off",
      translate: "no",
    }),
    EditorView.domEventHandlers({
      dragover(event, view) {
        if (!event.dataTransfer?.types.includes("Files")) return false;
        event.preventDefault();
        view.dom.classList.add("cm-drop-target");
        return true;
      },
      dragleave(event, view) {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !view.dom.contains(next)) {
          view.dom.classList.remove("cm-drop-target");
        }
        return false;
      },
      drop(event, view) {
        const files = droppedFiles(event);
        if (files.length === 0) return false;
        event.preventDefault();
        view.dom.classList.remove("cm-drop-target");
        const position =
          view.posAtCoords({ x: event.clientX, y: event.clientY }) ??
          view.state.selection.main.head;
        config.onFiles?.(files, position);
        return true;
      },
      paste(event, view) {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length === 0) return false;
        event.preventDefault();
        config.onFiles?.(files, view.state.selection.main.head);
        return true;
      },
    }),
    config.readOnly.of(readOnlyExtensions(config.isReadOnly)),
    config.nonce ? EditorView.cspNonce.of(config.nonce) : [],
    livePreview,
    livePreviewAtomic,
    anchorField,
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      if (
        update.transactions.some((transaction) =>
          transaction.annotation(externalSync),
        )
      ) {
        return;
      }
      config.onChange(update.state.sliceDoc());
    }),
  ];
}
