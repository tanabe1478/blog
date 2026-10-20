import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRenderer } from "./render.mjs";

// The text a reader would copy: tags removed and entities decoded.
const plain = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replaceAll("&amp;", "&");

const preOf = (html) => html.match(/<pre[\s\S]*?<\/pre>/)[0];

describe("code block rendering", () => {
  let render;
  before(async () => {
    render = await createRenderer();
  });

  it("highlights a fenced block with Shiki CSS variables and adds a header", async () => {
    const input =
      '<p>run</p><pre data-language="bash" class="hljs"><code>echo <span class="hljs-string">\'a &amp; b\'</span> &gt; out\n</code></pre>';
    const { html, hasCode, hasMermaid } = await render(input);

    assert.equal(hasCode, true);
    assert.equal(hasMermaid, false);
    assert.match(html, /^<p>run<\/p><figure class="code-block" data-language="bash">/);
    assert.match(html, /<span class="code-language">bash<\/span>/);
    assert.match(html, /<button type="button" class="code-copy">コピー<\/button>/);
    assert.match(html, /<pre class="shiki[^"]*"[^>]*>/);
    assert.match(html, /var\(--shiki-token-[a-z-]+\)/);
    assert.doesNotMatch(html, /hljs/);
    assert.equal(plain(preOf(html)), "echo 'a & b' > out");
  });

  it("colors shell arguments as plain text and options as constants", async () => {
    const { html } = await render('<pre data-language="bash" class="hljs"><code>docker run -d pid-lab\n</code></pre>');

    assert.match(html, /<span style="color:var\(--shiki-foreground\)">\s*pid-lab<\/span>/);
    assert.match(html, /<span style="color:var\(--shiki-token-constant\)">\s*-d<\/span>/);
  });

  it("keeps a block without a language as plain text and omits the label", async () => {
    const { html, hasCode } = await render("<pre><code>a &lt;b&gt;\n</code></pre>");

    assert.equal(hasCode, true);
    assert.match(html, /<figure class="code-block" data-language="">/);
    assert.doesNotMatch(html, /code-language/);
    assert.equal(plain(preOf(html)), "a <b>");
  });

  it("labels an unknown language without highlighting it", async () => {
    const { html } = await render('<pre data-language="nosuchlang" class="hljs"><code>x = 1\n</code></pre>');

    assert.match(html, /<span class="code-language">nosuchlang<\/span>/);
    assert.doesNotMatch(html, /--shiki-token-/);
    assert.equal(plain(preOf(html)), "x = 1");
  });

  it("turns a mermaid block into a diagram box that shows the source without JavaScript", async () => {
    const source = "flowchart LR\n  A[&quot;Host&quot;] --&gt; B\n";
    const { html, hasCode, hasMermaid } = await render(
      `<pre data-language="mermaid" class="hljs"><code>${source}</code></pre>`,
    );

    assert.equal(hasMermaid, true);
    assert.equal(hasCode, false);
    assert.match(html, /^<figure class="mermaid-block">/);
    assert.match(html, /<span class="code-language">mermaid<\/span>/);
    assert.match(html, /<div class="mermaid-toggle" role="group" aria-label="表示形式" hidden>/);
    assert.match(html, /<button type="button" data-view="diagram" aria-pressed="true">図<\/button>/);
    assert.match(html, /<button type="button" data-view="code" aria-pressed="false">コード<\/button>/);
    assert.match(html, /<div class="mermaid-diagram" hidden><\/div>/);
    assert.match(html, /<pre class="mermaid-source"><code>flowchart LR\n {2}A\[&quot;Host&quot;\] --&gt; B<\/code><\/pre>/);
  });

  it("leaves pages without code blocks and inline code untouched", async () => {
    const input = "<p>use <code>ls</code></p>";
    const result = await render(input);

    assert.deepEqual(result, { html: input, hasCode: false, hasMermaid: false });
  });
});
