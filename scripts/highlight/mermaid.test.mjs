import assert from "node:assert/strict";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { createDiagramRenderer, toCssVariables } from "./mermaid.mjs";

describe("Mermaid diagrams drawn at build time", () => {
  it("replaces the placeholder colors with design token variables", () => {
    assert.equal(
      toCssVariables(".node rect{fill:#0a0b0c;stroke:#1e1f20}.label{color:#141516}"),
      ".node rect{fill:var(--color-diagram-node);stroke:var(--color-accent)}.label{color:var(--color-text)}",
    );
  });

  it("draws an SVG colored by tokens and reuses it from the cache", async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), "mermaid-cache-"));
    const source = 'flowchart LR\n  A["ホスト"] --> B["コンテナ"]';
    const renderer = createDiagramRenderer({ cacheDir });

    const svg = await renderer.render(source);
    assert.match(svg, /^<svg[^>]*id="mermaid-[0-9a-f]{12}"/);
    assert.match(svg, /ホスト/);
    assert.match(svg, /var\(--color-diagram-node\)/);
    assert.doesNotMatch(svg, /#0a0b0c|#141516|#1e1f20/);
    assert.equal(await renderer.render(source), svg);
    assert.deepEqual(renderer.stats, { drawn: 1, cached: 1 });
    await renderer.close();
    assert.equal((await readdir(cacheDir)).length, 1);

    const fresh = createDiagramRenderer({ cacheDir });
    assert.equal(await fresh.render(source), svg);
    assert.deepEqual(fresh.stats, { drawn: 0, cached: 1 });
    assert.equal(fresh.launched, false);
    await fresh.close();
  });

  it("returns null when the source is not a diagram", async () => {
    const renderer = createDiagramRenderer({ cacheDir: await mkdtemp(join(tmpdir(), "mermaid-cache-")) });
    assert.equal(await renderer.render("this is not mermaid"), null);
    await renderer.close();
  });
});
