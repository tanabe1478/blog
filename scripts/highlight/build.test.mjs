import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { processOutput } from "./build.mjs";

const page = (body) => `<!DOCTYPE html><html><body><main>${body}</main></body></html>`;
const SCRIPT = '<script type="module" src="/scripts/code-blocks.js"></script></body>';

describe("processing Output/", () => {
  it("rewrites code pages, loads the script there only, and copies mermaid when used", async () => {
    const dir = await mkdtemp(join(tmpdir(), "highlight-"));
    await mkdir(join(dir, "posts", "a"), { recursive: true });
    await writeFile(join(dir, "posts", "a", "index.html"), page('<pre data-language="sh" class="hljs"><code>ls\n</code></pre>'));
    await writeFile(join(dir, "diagram.html"), page('<pre data-language="mermaid" class="hljs"><code>flowchart LR\n</code></pre>'));
    await writeFile(join(dir, "index.html"), page("<p>no code</p>"));

    const summary = await processOutput(dir);

    assert.deepEqual(summary, { pages: 2, mermaidPages: 1 });
    const code = await readFile(join(dir, "posts", "a", "index.html"), "utf8");
    assert.match(code, /<figure class="code-block" data-language="sh">/);
    assert.ok(code.endsWith(`${SCRIPT}</html>`));
    assert.ok((await readFile(join(dir, "diagram.html"), "utf8")).includes(SCRIPT));
    assert.equal(await readFile(join(dir, "index.html"), "utf8"), page("<p>no code</p>"));
    assert.ok(existsSync(join(dir, "vendor", "mermaid", "mermaid.esm.min.mjs")));
  });

  it("does not copy mermaid when no page uses it", async () => {
    const dir = await mkdtemp(join(tmpdir(), "highlight-"));
    await writeFile(join(dir, "index.html"), page('<pre><code>plain\n</code></pre>'));

    assert.deepEqual(await processOutput(dir), { pages: 1, mermaidPages: 0 });
    assert.equal(existsSync(join(dir, "vendor")), false);
  });
});
