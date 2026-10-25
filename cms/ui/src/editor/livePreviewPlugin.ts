import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";

import { frontmatterRange } from "../frontmatter";
import { buildLivePreview } from "./livePreview";
import { BadgeWidget, ImageWidget } from "./widgets";

const empty = Decoration.set([]);

class LivePreviewPlugin {
  decorations: DecorationSet = empty;
  atomic: DecorationSet = empty;

  constructor(view: EditorView) {
    this.build(view);
  }

  update(update: ViewUpdate): void {
    if (update.view.composing) return;
    this.build(update.view);
  }

  private build(view: EditorView): void {
    const state = view.state;
    const tree = ensureSyntaxTree(state, state.doc.length, 100) ?? syntaxTree(state);
    const specs = buildLivePreview({
      text: state.doc,
      tree,
      selections: state.selection.ranges,
      frontmatter: frontmatterRange(state.sliceDoc()),
    });
    const ranges = [];

    for (const line of specs.lines) {
      ranges.push(Decoration.line({ class: line.className }).range(line.from));
    }
    for (const hide of specs.hides) {
      ranges.push(Decoration.replace({}).range(hide.from, hide.to));
    }
    for (const mark of specs.marks) {
      ranges.push(Decoration.mark({ class: mark.className }).range(mark.from, mark.to));
    }
    for (const image of specs.images) {
      ranges.push(
        Decoration.replace({
          widget: new ImageWidget(image.src, image.alt),
        }).range(image.from, image.to),
      );
    }
    for (const badge of specs.badges) {
      ranges.push(
        Decoration.widget({
          widget: new BadgeWidget(badge.text, badge.className),
          side: 1,
        }).range(badge.pos),
      );
    }

    this.decorations = Decoration.set(ranges, true);
    this.atomic = Decoration.set(
      specs.images.map((image) => Decoration.replace({}).range(image.from, image.to)),
      true,
    );
  }
}

export const livePreview = ViewPlugin.fromClass(LivePreviewPlugin, {
  decorations: (plugin) => plugin.decorations,
});

export const livePreviewAtomic = EditorView.atomicRanges.of(
  (view) => view.plugin(livePreview)?.atomic ?? empty,
);
