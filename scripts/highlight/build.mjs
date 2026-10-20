// Usage: node scripts/highlight/build.mjs OUTPUT_DIR
// Runs after the MoonBit build (scripts/build_site.sh) and rewrites code and
// mermaid blocks in every HTML file of OUTPUT_DIR.
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createRenderer } from "./render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const MERMAID_DIST = join(here, "node_modules", "mermaid", "dist");
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

// Only the minified ESM entry and its chunks; source maps are left out.
async function copyMermaid(outputDir) {
  const target = join(outputDir, "vendor", "mermaid");
  await mkdir(target, { recursive: true });
  await cp(join(MERMAID_DIST, "mermaid.esm.min.mjs"), join(target, "mermaid.esm.min.mjs"));
  await cp(join(MERMAID_DIST, "chunks", "mermaid.esm.min"), join(target, "chunks", "mermaid.esm.min"), {
    recursive: true,
    filter: (source) => !source.endsWith(".map"),
  });
}

export async function processOutput(outputDir) {
  const render = await createRenderer();
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
  if (mermaidPages > 0) await copyMermaid(outputDir);
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
