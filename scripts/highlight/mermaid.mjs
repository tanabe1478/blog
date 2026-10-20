// Draws Mermaid diagrams to SVG at build time in a headless Chromium, so
// pages ship the SVG and load no Mermaid JavaScript. Each SVG is cached by
// its source, the Mermaid version and the drawing settings.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const MERMAID_JS = join(here, "node_modules", "mermaid", "dist", "mermaid.min.js");
const MERMAID_VERSION = JSON.parse(await readFile(join(here, "node_modules", "mermaid", "package.json"), "utf8")).version;
const RESOURCES = join(here, "..", "..", "Resources");
// Bump when the drawing changes in a way the cache key cannot see.
const RENDER_VERSION = 1;

// Diagrams are drawn with unique placeholder colors, which are then replaced
// with design token variables. One SVG then follows the light and dark themes.
const PLACEHOLDERS = {
  "#010203": "var(--color-background)",
  "#0a0b0c": "var(--color-diagram-node)",
  "#141516": "var(--color-text)",
  "#1e1f20": "var(--color-accent)",
  "#28292a": "var(--color-text-secondary)",
  "#323334": "var(--color-code-surface)",
  "#3c3d3e": "var(--color-border)",
  "rgba(1, 2, 3, 0.5)": "color-mix(in srgb, var(--color-background) 50%, transparent)",
};

const THEME = {
  fontFamily: '"Noto Sans JP", sans-serif',
  fontSize: "14px",
  background: "#010203",
  mainBkg: "#0a0b0c",
  primaryColor: "#0a0b0c",
  secondaryColor: "#0a0b0c",
  tertiaryColor: "#0a0b0c",
  primaryTextColor: "#141516",
  textColor: "#141516",
  titleColor: "#141516",
  primaryBorderColor: "#1e1f20",
  nodeBorder: "#1e1f20",
  lineColor: "#28292a",
  clusterBkg: "#323334",
  clusterBorder: "#3c3d3e",
  edgeLabelBackground: "#010203",
};

export const toCssVariables = (svg) =>
  Object.entries(PLACEHOLDERS).reduce((text, [color, variable]) => text.replaceAll(color, variable), svg);

// The page is served from an invented origin so it can load the site's own
// fonts.css and font files; labels are then measured with the page's font.
const HOST = "https://diagrams.invalid";
const PAGE =
  '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/MyHtmlTheme/fonts.css"></head>' +
  '<body><script src="/mermaid.min.js"></script></body></html>';
const TYPES = { ".css": "text/css", ".woff2": "font/woff2", ".js": "text/javascript" };

export function createDiagramRenderer({ cacheDir }) {
  let browser;
  let page;
  const stats = { drawn: 0, cached: 0 };

  const open = async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    await page.route(`${HOST}/**`, async (route) => {
      const path = decodeURIComponent(new URL(route.request().url()).pathname);
      if (path === "/") return route.fulfill({ contentType: "text/html", body: PAGE });
      const file = path === "/mermaid.min.js" ? MERMAID_JS : join(RESOURCES, path);
      try {
        await route.fulfill({ contentType: TYPES[extname(file)] ?? "application/octet-stream", body: await readFile(file) });
      } catch {
        await route.fulfill({ status: 404 });
      }
    });
    await page.goto(`${HOST}/`);
    await page.evaluate(
      (theme) => mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", themeVariables: theme }),
      THEME,
    );
  };

  const draw = async (id, source) => {
    if (!page) await open();
    return page.evaluate(
      async ({ id, source }) => {
        // Load the font slices for these characters before Mermaid measures them.
        await document.fonts.load('14px "Noto Sans JP"', source);
        try {
          return (await mermaid.render(id, source)).svg;
        } catch {
          return null;
        }
      },
      { id, source },
    );
  };

  return {
    stats,
    get launched() {
      return Boolean(browser);
    },
    async render(source) {
      const key = createHash("sha256")
        .update(JSON.stringify([MERMAID_VERSION, RENDER_VERSION, THEME, source]))
        .digest("hex");
      const file = join(cacheDir, `${key}.svg`);
      try {
        const svg = await readFile(file, "utf8");
        stats.cached++;
        return svg;
      } catch {
        // Not cached yet.
      }
      const drawn = await draw(`mermaid-${key.slice(0, 12)}`, source);
      if (drawn === null) return null;
      const svg = toCssVariables(drawn);
      await mkdir(cacheDir, { recursive: true });
      await writeFile(file, svg);
      stats.drawn++;
      return svg;
    },
    async close() {
      await browser?.close();
    },
  };
}
