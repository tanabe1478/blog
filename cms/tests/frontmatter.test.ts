import { describe, expect, it } from "vitest";

import {
  frontmatterRange,
  readFrontmatterValue,
  setFrontmatterValue,
  splitHeading,
  joinHeading,
} from "../ui/src/frontmatter";

const home = [
  "---",
  'profile: "@t__nabe1478"',
  "rss: 更新は RSS で受け取れます。",
  "---",
  "",
  "# ",
  "",
  "紹介文です。",
  "",
].join("\n");

describe("frontmatter helpers", () => {
  it("reads values and strips surrounding quotes", () => {
    expect(readFrontmatterValue(home, "profile")).toBe("@t__nabe1478");
    expect(readFrontmatterValue(home, "rss")).toBe("更新は RSS で受け取れます。");
    expect(readFrontmatterValue(home, "missing")).toBe("");
  });

  it("replaces a value and keeps every other line", () => {
    const next = setFrontmatterValue(home, "rss", "RSS でどうぞ");
    expect(next).toBe(home.replace("rss: 更新は RSS で受け取れます。", "rss: RSS でどうぞ"));
  });

  it("quotes values that would otherwise be misread", () => {
    expect(setFrontmatterValue(home, "profile", "@me · engineer")).toContain('profile: "@me · engineer"');
    expect(setFrontmatterValue(home, "rss", "a: b")).toContain('rss: "a: b"');
    expect(setFrontmatterValue(home, "rss", 'say "hi"')).toContain("rss: 'say \"hi\"'");
  });

  it("adds, removes and creates frontmatter", () => {
    const pinned = setFrontmatterValue(home, "pinned", "true");
    expect(pinned).toContain("rss: 更新は RSS で受け取れます。\npinned: true\n---");
    expect(setFrontmatterValue(pinned, "pinned", null)).toBe(home);
    expect(setFrontmatterValue("# Title\n", "subtitle", "Sub")).toBe("---\nsubtitle: Sub\n---\n# Title\n");
  });

  it("keeps values on one line", () => {
    expect(setFrontmatterValue(home, "rss", "line one\nline two")).toContain("rss: line one line two");
  });

  it("reports the exact frontmatter range used by the editor", () => {
    expect(frontmatterRange(home)).toEqual({ from: 0, to: home.indexOf("\n\n# ") + 1 });
    expect(frontmatterRange("# Title\n")).toBeNull();
    expect(frontmatterRange("---\nunclosed\n")).toBeNull();
    expect(frontmatterRange("---\ntitle: A\n---\n\n---\n\nbody\n")).toEqual({
      from: 0,
      to: "---\ntitle: A\n---\n".length,
    });
  });

  it("splits the leading heading from the body and joins it back", () => {
    const about = "---\nsubtitle: Sub\n---\n\n# tanabe1478\n\nAbout me.\n\n## This blog\n\nText.\n";
    expect(splitHeading(about)).toEqual({ heading: "tanabe1478", body: "About me.\n\n## This blog\n\nText.\n" });
    expect(joinHeading(about, "New name", "Changed.\n")).toBe("---\nsubtitle: Sub\n---\n\n# New name\n\nChanged.\n");
    expect(splitHeading(home)).toEqual({ heading: "", body: "紹介文です。\n" });
    expect(joinHeading(home, "", "新しい紹介文。\n")).toBe(home.replace("紹介文です。\n", "新しい紹介文。\n"));
  });
});
