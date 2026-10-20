// Usage: node scripts/highlight/build.mjs OUTPUT_DIR
// Runs after the MoonBit build (scripts/build_site.sh) and rewrites code and
// mermaid blocks in every HTML file of OUTPUT_DIR.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createDiagramRenderer } from "./mermaid.mjs";
import { createRenderer } from "./render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
// Drawn diagrams are kept between builds (and between CI runs via actions/cache).
const DEFAULT_CACHE = join(here, "..", "..", ".cache", "mermaid");
const SCRIPT = '<script type="module" src="/scripts/code-blocks.js"></script>';

async function htmlFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

export async function processOutput(outputDir, { cacheDir = DEFAULT_CACHE } = {}) {
  const diagrams = createDiagramRenderer({ cacheDir });
  let failed = 0;
  const render = await createRenderer({
    renderDiagram: async (source) => {
      const svg = await diagrams.render(source);
      if (svg === null) failed++;
      return svg;
    },
  });
  let pages = 0;
  let mermaidPages = 0;
  for (const file of await htmlFiles(outputDir)) {
    const source = await readFile(file, "utf8");
    const { html, hasCode, hasMermaid } = await render(source);
    if (!hasCode && !hasMermaid) continue;
    pages++;
    if (hasMermaid) mermaidPages++;
    await writeFile(file, html.replace("</body>", `${SCRIPT}</body>`));
  }
  await diagrams.close();
  if (mermaidPages > 0) {
    const { drawn, cached } = diagrams.stats;
    console.log(`mermaid: ${drawn} drawn, ${cached} from cache, ${failed} shown as source`);
  }
  return { pages, mermaidPages };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputDir = process.argv[2];
  if (!outputDir) {
    console.error("usage: node scripts/highlight/build.mjs OUTPUT_DIR");
    process.exit(1);
  }
  const { pages, mermaidPages } = await processOutput(outputDir);
  console.log(`highlight: ${pages} pages with code blocks (${mermaidPages} with mermaid)`);
}
