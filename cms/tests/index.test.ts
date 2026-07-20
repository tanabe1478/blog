import { afterEach, describe, expect, it, vi } from "vitest";

import worker from "../src/index";

function fetch(path: string, init?: RequestInit): Promise<Response> {
  const request = new Request(`http://127.0.0.1${path}`, init);
  return worker.fetch(request as Parameters<typeof worker.fetch>[0], {
    POLICY_AUD: "test-audience",
    TEAM_DOMAIN: "https://test.cloudflareaccess.com",
    ACCESS_BYPASS: "true",
    GITHUB_TOKEN: "test-token",
    WRITE_HOST: "127.0.0.1",
  });
}

describe("CMS Worker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects production requests without an Access JWT", async () => {
    const request = new Request("https://cms.example.test/");
    const response = await worker.fetch(
      request as Parameters<typeof worker.fetch>[0],
      {
        POLICY_AUD: "test-audience",
        TEAM_DOMAIN: "https://test.cloudflareaccess.com",
        WRITE_HOST: "cms.example.test",
      },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("allows the explicit Wrangler local bypass flag", async () => {
    const request = new Request("https://cms.example.test/api/health");
    const response = await worker.fetch(
      request as Parameters<typeof worker.fetch>[0],
      {
        POLICY_AUD: "test-audience",
        TEAM_DOMAIN: "https://test.cloudflareaccess.com",
        ACCESS_BYPASS: true,
        WRITE_HOST: "cms.example.test",
      },
    );

    expect(response.status).toBe(200);
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
    expect(content).toContain("GitHub連携");
    expect(content).toContain('id="edit"');
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
    expect(response.headers.get("cache-control")).toBe("no-store");
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
      Response.json({
        name: "hello world.md",
        path: "Content/posts/hello world.md",
        type: "file",
        sha: "a".repeat(40),
        encoding: "base64",
        content: btoa("---\ndate: 2026-07-20\n---\n\n# Hello\n"),
      }),
    );
    vi.stubGlobal("fetch", upstream);

    const response = await fetch("/api/posts/hello%20world.md");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      post: {
        name: "hello world.md",
        path: "Content/posts/hello world.md",
        content: "---\ndate: 2026-07-20\n---\n\n# Hello\n",
        sha: "a".repeat(40),
        githubUrl:
          "https://github.com/tanabe1478/blog/blob/main/Content/posts/hello%20world.md",
      },
    });
    expect(upstream).toHaveBeenCalledWith(
      "https://api.github.com/repos/tanabe1478/blog/contents/Content/posts/hello%20world.md",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("updates an existing Markdown post with its current SHA", async () => {
    const upstream = vi.fn().mockResolvedValue(
      Response.json({
        content: { sha: "b".repeat(40) },
        commit: { sha: "c".repeat(40) },
      }),
    );
    vi.stubGlobal("fetch", upstream);

    const response = await fetch("/api/posts/hello.md", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1",
      },
      body: JSON.stringify({
        content: "# Updated\n",
        sha: "a".repeat(40),
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      update: {
        sha: "b".repeat(40),
        commitSha: "c".repeat(40),
        githubUrl:
          "https://github.com/tanabe1478/blog/blob/main/Content/posts/hello.md",
      },
    });
    expect(upstream).toHaveBeenCalledWith(
      "https://api.github.com/repos/tanabe1478/blog/contents/Content/posts/hello.md",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          authorization: "Bearer test-token",
        }),
      }),
    );
    const requestBody = JSON.parse(upstream.mock.calls[0][1].body);
    expect(requestBody).toEqual({
      message: "post: update hello.md via CMS",
      content: btoa("# Updated\n"),
      sha: "a".repeat(40),
      branch: "main",
    });
  });

  it("rejects writes through a Preview hostname", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const request = new Request(
      "https://preview-tanabe-blog-cms-api.example.workers.dev/api/posts/hello.md",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "https://preview-tanabe-blog-cms-api.example.workers.dev",
        },
        body: JSON.stringify({
          content: "# Updated\n",
          sha: "a".repeat(40),
        }),
      },
    );

    const response = await worker.fetch(
      request as Parameters<typeof worker.fetch>[0],
      {
        POLICY_AUD: "test-audience",
        TEAM_DOMAIN: "https://test.cloudflareaccess.com",
        ACCESS_BYPASS: true,
        GITHUB_TOKEN: "test-token",
        WRITE_HOST: "tanabe-blog-cms-api.example.workers.dev",
      },
    );

    expect(response.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("reports a conflict instead of overwriting a newer post", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 409 })),
    );

    const response = await fetch("/api/posts/hello.md", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1",
      },
      body: JSON.stringify({
        content: "# Updated\n",
        sha: "a".repeat(40),
      }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "記事が他の場所で更新されています。再読み込みしてください",
    });
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
        Response.json({
          name: "large.md",
          path: "Content/posts/large.md",
          type: "file",
          sha: "a".repeat(40),
          encoding: "base64",
          content: btoa("x".repeat(1_000_001)),
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
