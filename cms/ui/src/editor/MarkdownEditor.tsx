import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";

import { Compartment, EditorState, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { bodyStart } from "../frontmatter";
import {
  captureAnchorEffect,
  insertAtAnchorTransaction,
  type AnchorId,
} from "./anchors";
import {
  createExtensions,
  externalSync,
  readOnlyExtensions,
} from "./extensions";
import { readCspNonce } from "./nonce";
import { stringOffsetToDoc } from "../textPosition";
import { minimalChange } from "./textChange";
import "./editor.css";

declare global {
  interface HTMLElement {
    __cmsGetMarkdown?: () => string;
  }
}

export interface MarkdownEditorHandle {
  focus: () => void;
  captureAnchor: () => AnchorId | undefined;
  captureAnchorAt: (position: number) => AnchorId | undefined;
  insertAt: (anchor: AnchorId, markdown: string) => boolean;
  value: () => string;
}

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  hasFrontmatter: boolean;
  readOnly?: boolean;
  autoFocus?: "start" | "body" | false;
  onFiles?: (files: File[], position: number) => void;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(props, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const readOnlyCompartment = useRef(new Compartment());
    const onChangeRef = useRef(props.onChange);
    const onFilesRef = useRef(props.onFiles);
    const autoFocusRef = useRef(props.autoFocus);
    const recentLocalValues = useRef<string[]>([]);

    onChangeRef.current = props.onChange;
    onFilesRef.current = props.onFiles;

    useLayoutEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const view = new EditorView({
        parent: host,
        state: EditorState.create({
          doc: props.value,
          extensions: createExtensions({
            source: props.value,
            nonce: readCspNonce(),
            ariaLabel: props.ariaLabel,
            readOnly: readOnlyCompartment.current,
            isReadOnly: Boolean(props.readOnly),
            hasFrontmatter: props.hasFrontmatter,
            onChange(next) {
              recentLocalValues.current.push(next);
              if (recentLocalValues.current.length > 20) recentLocalValues.current.shift();
              onChangeRef.current(next);
            },
            onFiles(files, position) {
              onFilesRef.current?.(files, position);
            },
          }),
        }),
      });
      viewRef.current = view;
      host.__cmsGetMarkdown = () => view.state.sliceDoc();

      if (autoFocusRef.current) {
        const position =
          autoFocusRef.current === "body" ? bodyStart(view.state.sliceDoc()) : 0;
        view.dispatch({ selection: { anchor: position } });
        view.focus();
      }

      return () => {
        delete host.__cmsGetMarkdown;
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.sliceDoc();
      if (current === props.value) return;
      if (recentLocalValues.current.includes(props.value)) return;
      if (view.composing) return;

      recentLocalValues.current = [];
      const change = minimalChange(current, props.value);
      const lineBreak = view.state.lineBreak;
      view.dispatch({
        changes: {
          from: stringOffsetToDoc(current, change.from, lineBreak),
          to: stringOffsetToDoc(current, change.to, lineBreak),
          insert: change.insert,
        },
        annotations: [
          externalSync.of(true),
          Transaction.addToHistory.of(false),
        ],
      });
    }, [props.value]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: readOnlyCompartment.current.reconfigure(
          readOnlyExtensions(Boolean(props.readOnly)),
        ),
      });
    }, [props.readOnly]);

    useImperativeHandle(
      ref,
      () => ({
        focus() {
          viewRef.current?.focus();
        },
        captureAnchor() {
          return captureAt();
        },
        captureAnchorAt(position) {
          return captureAt(position);
        },
        insertAt(anchor, markdown) {
          const view = viewRef.current;
          if (!view) return false;
          const result = insertAtAnchorTransaction(view.state, anchor, markdown);
          view.dispatch(result.transaction);
          view.focus();
          return true;
        },
        value() {
          return viewRef.current?.state.sliceDoc() ?? "";
        },
      }),
      [],
    );

    function captureAt(position?: number): AnchorId | undefined {
      const view = viewRef.current;
      if (!view) return undefined;
      const captured = captureAnchorEffect(view.state, position);
      view.dispatch({ effects: captured.effect });
      return captured.id;
    }

    return (
      <div
        ref={hostRef}
        className="markdown-editor-shell"
        data-markdown-editor={props.ariaLabel}
      />
    );
  },
);
