import { describe, expect, it } from "vitest";

import {
  bodyStart,
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

  it("finds the editable body after frontmatter, blank lines, and the heading", () => {
    const about = "---\nsubtitle: Sub\n---\n\n# tanabe1478\n\nAbout me.\n\n## This blog\n\nText.\n";
    expect(bodyStart(about)).toBe(about.indexOf("About me."));
    expect(bodyStart(home)).toBe(home.indexOf("紹介文です。"));
    expect(bodyStart("本文だけ\n")).toBe(0);
    expect(bodyStart("---\ntitle: A\n---\n\n# Title\n\n")).toBe(
      "---\ntitle: A\n---\n\n# Title\n\n".length,
    );
  });

  it("keeps CRLF frontmatter, headings and body positions consistent", () => {
    const crlfHome = home.replace(/\n/g, "\r\n");
    expect(readFrontmatterValue(crlfHome, "profile")).toBe("@t__nabe1478");
    expect(frontmatterRange(crlfHome)).toEqual(frontmatterRange(home));
    expect(bodyStart(crlfHome)).toBe(bodyStart(home));
    expect(setFrontmatterValue(crlfHome, "pinned", "true")).toBe(
      setFrontmatterValue(home, "pinned", "true").replace(/\n/g, "\r\n"),
    );
    expect(splitHeading(crlfHome)).toEqual({
      heading: "",
      body: "紹介文です。\r\n",
    });
    expect(joinHeading(crlfHome, "", "新しい紹介文。\r\n")).toBe(
      crlfHome.replace("紹介文です。\r\n", "新しい紹介文。\r\n"),
    );
  });

  it("splits the leading heading from the body and joins it back", () => {
    const about = "---\nsubtitle: Sub\n---\n\n# tanabe1478\n\nAbout me.\n\n## This blog\n\nText.\n";
    expect(splitHeading(about)).toEqual({ heading: "tanabe1478", body: "About me.\n\n## This blog\n\nText.\n" });
    expect(joinHeading(about, "New name", "Changed.\n")).toBe("---\nsubtitle: Sub\n---\n\n# New name\n\nChanged.\n");
    expect(splitHeading(home)).toEqual({ heading: "", body: "紹介文です。\n" });
    expect(joinHeading(home, "", "新しい紹介文。\n")).toBe(home.replace("紹介文です。\n", "新しい紹介文。\n"));
  });
});
