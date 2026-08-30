import { afterEach, describe, expect, it, vi } from "vitest";

import { invalidatePost, preloadPost, readPost, setCachedPost } from "../ui/src/postResource";
import type { PostDocument } from "../ui/src/api";

function post(name: string, content = "# Cached\n"): PostDocument {
  return {
    name,
    path: `Content/posts/${name}`,
    content,
    sha: "a".repeat(40),
    githubUrl: `https://github.com/tanabe1478/blog/blob/main/Content/posts/${name}`,
    publicUrl: `https://tanabe1478.github.io/posts/${name.slice(0, -3)}/`,
  };
}

function suspended(name: string): Promise<void> {
  try {
    readPost(name);
  } catch (cause) {
    if (cause instanceof Promise) return cause as Promise<void>;
    throw cause;
  }
  throw new Error("Expected article read to suspend");
}

describe("post resource", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reuses one stable request for preload and suspended reads", async () => {
    const name = "suspense-cache.md";
    const document = post(name);
    const request = vi.fn().mockResolvedValue(Response.json({ post: document }));
    vi.stubGlobal("fetch", request);

    preloadPost(name);
    const promise = suspended(name);
    expect(suspended(name)).toBe(promise);
    await promise;

    expect(readPost(name)).toEqual(document);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed article request after suspension", async () => {
    const name = "suspense-error.md";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({ error: "記事を取得できませんでした" }, { status: 502 }),
      ),
    );

    await suspended(name);
    expect(() => readPost(name)).toThrow("記事を取得できませんでした");
  });

  it("updates and invalidates cached articles after mutations", async () => {
    const name = "suspense-mutation.md";
    const cached = post(name, "# Updated\n");
    setCachedPost(cached);
    expect(readPost(name)).toEqual(cached);

    const refreshed = post(name, "# Refetched\n");
    const request = vi.fn().mockResolvedValue(Response.json({ post: refreshed }));
    vi.stubGlobal("fetch", request);
    invalidatePost(name);
    await suspended(name);

    expect(readPost(name)).toEqual(refreshed);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
