import { describe, expect, it } from "vitest";

import { previewImageUrl } from "../ui/src/previewUrl";

describe("previewImageUrl", () => {
  it("reads uploaded images from the main branch before deployment", () => {
    expect(previewImageUrl("/images/hello/0123.png")).toBe(
      "https://raw.githubusercontent.com/tanabe1478/blog/main/Resources/images/hello/0123.png",
    );
  });

  it("maps other root-relative paths to GitHub Pages", () => {
    expect(previewImageUrl("/posts/hello/cover.png")).toBe(
      "https://tanabe1478.github.io/posts/hello/cover.png",
    );
  });

  it("leaves absolute and relative URLs to the renderer", () => {
    expect(previewImageUrl("https://example.test/a.png")).toBe("https://example.test/a.png");
    expect(previewImageUrl("cover.png")).toBe("cover.png");
  });
});
