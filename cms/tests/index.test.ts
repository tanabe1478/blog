import { afterEach, describe, expect, it, vi } from "vitest";

import worker from "../src/index";

function fetch(path: string, init?: RequestInit): Promise<Response> {
  const request = new Request(`http://127.0.0.1${path}`, init);
  return worker.fetch(request as Parameters<typeof worker.fetch>[0], {
    POLICY_AUD: "test-audience",
    TEAM_DOMAIN: "https://test.cloudflareaccess.com",
    ACCESS_BYPASS: "true",
    GITHUB_TOKEN: "test-token",
    GYAZO_ACCESS_TOKEN: "test-gyazo-token",
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

  it("renders article details and editing controls", async () => {
    const response = await fetch("/");
    const content = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(content).toContain("<h1>Blog CMS</h1>");
    expect(content).toContain("GitHub連携");
    expect(content).toContain('id="new-post"');
    expect(content).toContain('id="new-post-form"');
    expect(content).toContain('id="public-link"');
    expect(content).toContain('公開ページを開く');
    expect(content).toContain('id="draft-notice"');
    expect(content).toContain('id="draft-restore"');
    expect(content).toContain('id="draft-discard"');
    expect(content).toContain("localStorage.setItem(draftKey(activePost)");
    expect(content).toContain('id="edit"');
    expect(content).toContain('id="image"');
    expect(content).toContain("postContent.addEventListener('drop'");
    expect(content).toContain('id="detail"');
    expect(content).toContain(
      'id="post-content" aria-label="Markdown本文" readonly hidden',
    );
    expect(content).toContain(
      'id="preview" class="preview" aria-label="記事プレビュー" hidden',
    );
    expect(content).toContain("postContent.hidden = !editing");
    const script = content.match(/<script>([\s\S]*)<\/script>/)?.[1];
    expect(script).toBeDefined();
    expect(() => new Function(script ?? "")).not.toThrow();
  });

  it("returns Markdown posts from the public repository", async () => {
    const upstream = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          repository: {
            object: {
              entries: [
                {
                  name: "second post.md",
                  type: "blob",
                  object: {
                    text: "---\ndate: 2026-02-03 10:00\n---\n\n# Second post\n",
                  },
                },
                {
                  name: "assets",
                  type: "tree",
                  object: null,
                },
                {
                  name: "index.md",
                  type: "blob",
                  object: { text: "# My posts\n" },
                },
                {
                  name: "first.md",
                  type: "blob",
                  object: {
                    text: "---\ndate: 2025-01-02 09:00\n---\n\n# First post\n",
                  },
                },
              ],
            },
          },
        },
      }),
    );
    vi.stubGlobal("fetch", upstream);

    const response = await fetch("/api/posts");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      posts: [
        {
          name: "second post.md",
          title: "Second post",
          date: "2026-02-03 10:00",
          path: "Content/posts/second post.md",
          githubUrl:
            "https://github.com/tanabe1478/blog/blob/main/Content/posts/second%20post.md",
          publicUrl:
            "https://tanabe1478.github.io/posts/second%20post/",
        },
        {
          name: "first.md",
          title: "First post",
          date: "2025-01-02 09:00",
          path: "Content/posts/first.md",
          githubUrl:
            "https://github.com/tanabe1478/blog/blob/main/Content/posts/first.md",
          publicUrl: "https://tanabe1478.github.io/posts/first/",
        },
      ],
    });
    expect(upstream).toHaveBeenCalledWith(
      "https://api.github.com/graphql",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-token",
        }),
      }),
    );
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
        publicUrl:
          "https://tanabe1478.github.io/posts/hello%20world/",
      },
    });
    expect(upstream).toHaveBeenCalledWith(
      "https://api.github.com/repos/tanabe1478/blog/contents/Content/posts/hello%20world.md",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("uploads a validated image to Gyazo", async () => {
    const upstream = vi.fn().mockResolvedValue(
      Response.json({
        url: "https://i.gyazo.com/image.png",
        permalink_url: "https://gyazo.com/example",
      }),
    );
    vi.stubGlobal("fetch", upstream);
    const form = new FormData();
    form.append(
      "image",
      new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
        type: "image/png",
      }),
      "screen.png",
    );

    const response = await fetch("/api/images", {
      method: "POST",
      headers: { origin: "http://127.0.0.1" },
      body: form,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      image: {
        imageUrl: "https://i.gyazo.com/image.png",
        permalinkUrl: "https://gyazo.com/example",
        markdown:
          "[![screen](https://i.gyazo.com/image.png)](https://gyazo.com/example)",
      },
    });
    expect(upstream).toHaveBeenCalledWith(
      "https://upload.gyazo.com/api/upload",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-gyazo-token",
        }),
        body: expect.any(FormData),
      }),
    );
  });

  it("rejects a file whose signature is not an image", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const form = new FormData();
    form.append(
      "image",
      new Blob(["not an image"], { type: "image/png" }),
      "fake.png",
    );

    const response = await fetch("/api/images", {
      method: "POST",
      headers: { origin: "http://127.0.0.1" },
      body: form,
    });

    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
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

  it("creates a new Markdown post without a SHA", async () => {
    const upstream = vi.fn().mockResolvedValue(
      Response.json({
        content: { sha: "b".repeat(40) },
        commit: { sha: "c".repeat(40) },
      }),
    );
    vi.stubGlobal("fetch", upstream);
    const content =
      '---\ndate: 2026-07-21 09:30\ndescription: "New post"\ntags: 日記\n---\n\n# New post\n\n本文\n';

    const response = await fetch("/api/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1",
      },
      body: JSON.stringify({ name: "new-post.md", content }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      post: {
        name: "new-post.md",
        sha: "b".repeat(40),
        commitSha: "c".repeat(40),
        githubUrl:
          "https://github.com/tanabe1478/blog/blob/main/Content/posts/new-post.md",
        publicUrl: "https://tanabe1478.github.io/posts/new-post/",
      },
    });
    expect(upstream).toHaveBeenCalledWith(
      "https://api.github.com/repos/tanabe1478/blog/contents/Content/posts/new-post.md",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ authorization: "Bearer test-token" }),
      }),
    );
    const requestBody = JSON.parse(upstream.mock.calls[0][1].body);
    expect(requestBody).toEqual({
      message: "post: create new-post.md via CMS",
      content: btoa(
        String.fromCharCode(...new TextEncoder().encode(content)),
      ),
      branch: "main",
    });
  });

  it("rejects an invalid new post slug before calling GitHub", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await fetch("/api/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1",
      },
      body: JSON.stringify({
        name: "Invalid Slug.md",
        content: "---\ndate: 2026-07-21 09:30\n---\n\n# Title\n",
      }),
    });

    expect(response.status).toBe(400);

    const reservedResponse = await fetch("/api/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1",
      },
      body: JSON.stringify({
        name: "index.md",
        content: "---\ndate: 2026-07-21 09:30\n---\n\n# Index\n",
      }),
    });
    expect(reservedResponse.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("does not overwrite an existing post during creation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 422 })),
    );

    const response = await fetch("/api/posts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1",
      },
      body: JSON.stringify({
        name: "existing.md",
        content: "---\ndate: 2026-07-21 09:30\n---\n\n# Existing\n",
      }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "同じslugの記事が既に存在します",
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
