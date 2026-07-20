import { afterEach, describe, expect, it, vi } from "vitest";

import worker from "../src/index";

function fetch(path: string, init?: RequestInit): Promise<Response> {
  const request = new Request(`https://cms.example.test${path}`, init);
  return worker.fetch(request as Parameters<typeof worker.fetch>[0]);
}

describe("CMS Worker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the read-only CMS page", async () => {
    const response = await fetch("/");
    const content = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(content).toContain("<h1>Blog CMS</h1>");
    expect(content).toContain("読み取り専用");
    expect(content).toContain('id="detail"');
    expect(content).toContain('id="post-content"');
  });

  it("returns Markdown posts from the public repository", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json([
          {
            name: "second post.md",
            path: "Content/posts/second post.md",
            type: "file",
          },
          {
            name: "assets",
            path: "Content/posts/assets",
            type: "dir",
          },
          {
            name: "first.md",
            path: "Content/posts/first.md",
            type: "file",
          },
        ]),
      ),
    );

    const response = await fetch("/api/posts");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(await response.json()).toEqual({
      posts: [
        {
          name: "first.md",
          path: "Content/posts/first.md",
          githubUrl:
            "https://github.com/tanabe1478/blog/blob/main/Content/posts/first.md",
        },
        {
          name: "second post.md",
          path: "Content/posts/second post.md",
          githubUrl:
            "https://github.com/tanabe1478/blog/blob/main/Content/posts/second%20post.md",
        },
      ],
    });
  });

  it("returns one Markdown post for the detail view", async () => {
    const upstream = vi.fn().mockResolvedValue(
      new Response("---\ndate: 2026-07-20\n---\n\n# Hello\n"),
    );
    vi.stubGlobal("fetch", upstream);

    const response = await fetch("/api/posts/hello%20world.md");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(await response.json()).toEqual({
      post: {
        name: "hello world.md",
        path: "Content/posts/hello world.md",
        content: "---\ndate: 2026-07-20\n---\n\n# Hello\n",
        githubUrl:
          "https://github.com/tanabe1478/blog/blob/main/Content/posts/hello%20world.md",
      },
    });
    expect(upstream).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/tanabe1478/blog/main/Content/posts/hello%20world.md",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("rejects path traversal before requesting GitHub", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await fetch("/api/posts/..%2Fsecret.md");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "記事名が不正です" });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("returns 404 when a Markdown post does not exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );

    const response = await fetch("/api/posts/missing.md");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "記事が見つかりません" });
  });

  it("rejects an oversized Markdown post", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("small body", {
          headers: { "content-length": "1000001" },
        }),
      ),
    );

    const response = await fetch("/api/posts/large.md");

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "記事を取得できませんでした",
    });
  });

  it("hides upstream errors behind a safe response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    );

    const response = await fetch("/api/posts");

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "記事一覧を取得できませんでした",
    });
  });

  it("returns its health status", async () => {
    const response = await fetch("/api/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      service: "tanabe-blog-cms-api",
      status: "ok",
    });
  });

  it("returns JSON for unknown routes", async () => {
    const response = await fetch("/missing");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });
});
