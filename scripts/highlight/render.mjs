// Rewrites the <pre> blocks that moonbit-ssg writes into Output/ HTML:
// highlighted code gets a header with its language and a copy button, and
// mermaid blocks become a diagram box that /scripts/code-blocks.js draws.
import { bundledLanguages, createCssVariablesTheme, createHighlighter } from "shiki";

// Colors come from CSS variables, so design/tokens.json decides them and
// light / dark switch without highlighting twice.
const theme = createCssVariablesTheme({
  name: "css-variables",
  variablePrefix: "--shiki-",
  fontStyle: true,
});

const PRE = /<pre(?: data-language="([^"]*)" class="hljs")?><code>([\s\S]*?)<\/code><\/pre>/g;
const ENTITIES = { lt: "<", gt: ">", quot: '"', "#39": "'", amp: "&" };

// moonbit-ssg wraps a few tokens in hljs spans; only the text matters here.
const decode = (html) =>
  html.replace(/<[^>]+>/g, "").replace(/&(lt|gt|quot|#39|amp);/g, (_, name) => ENTITIES[name]);

const escape = (text) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const label = (language) =>
  language ? `<span class="code-language">${escape(language)}</span>` : "";

const mermaidBlock = (source) =>
  '<figure class="mermaid-block"><div class="code-header">' +
  label("mermaid") +
  '<div class="mermaid-toggle" role="group" aria-label="表示形式" hidden>' +
  '<button type="button" data-view="diagram" aria-pressed="true">図</button>' +
  '<button type="button" data-view="code" aria-pressed="false">コード</button>' +
  "</div></div>" +
  '<div class="mermaid-diagram" hidden></div>' +
  `<pre class="mermaid-source"><code>${escape(source)}</code></pre></figure>`;

export async function createRenderer() {
  const highlighter = await createHighlighter({ themes: [theme], langs: [] });

  const highlight = async (code, language) => {
    const known = Object.hasOwn(bundledLanguages, language);
    if (known && !highlighter.getLoadedLanguages().includes(language)) {
      await highlighter.loadLanguage(language);
    }
    return highlighter.codeToHtml(code, {
      lang: known ? language : "text",
      theme: theme.name,
      // The block's CSS sets the background, not an inline style.
      transformers: [{ pre: (node) => void delete node.properties.style }],
    });
  };

  return async function render(html) {
    let hasCode = false;
    let hasMermaid = false;
    const blocks = [];
    for (const match of html.matchAll(PRE)) {
      const language = match[1] ?? "";
      const code = decode(match[2]).replace(/\n$/, "");
      if (language === "mermaid") {
        hasMermaid = true;
        blocks.push(mermaidBlock(code));
        continue;
      }
      hasCode = true;
      blocks.push(
        `<figure class="code-block" data-language="${escape(language)}"><div class="code-header">` +
          label(language) +
          '<button type="button" class="code-copy">コピー</button></div>' +
          (await highlight(code, language)) +
          "</figure>",
      );
    }
    if (blocks.length === 0) return { html, hasCode, hasMermaid };
    let index = 0;
    return { html: html.replace(PRE, () => blocks[index++]), hasCode, hasMermaid };
  };
}
