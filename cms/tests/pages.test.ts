import { afterEach, describe, expect, it, vi } from "vitest";

import worker from "../src/index";

const env = {
  POLICY_AUD: "test-audience",
  TEAM_DOMAIN: "https://test.cloudflareaccess.com",
  ACCESS_BYPASS: "true",
  GITHUB_TOKEN: "test-token",
  WRITE_HOST: "127.0.0.1",
};

function fetch(path: string, init?: RequestInit): Promise<Response> {
  const request = new Request(`http://127.0.0.1${path}`, init);
  return worker.fetch(request as Parameters<typeof worker.fetch>[0], env);
}

function put(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: "PUT",
    headers: { "content-type": "application/json", origin: "http://127.0.0.1" },
    body: JSON.stringify(body),
  });
}

describe("CMS page API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns the home page source from Content/index.md", async () => {
    const upstream = vi.fn().mockResolvedValue(
      Response.json({
        type: "file",
        sha: "a".repeat(40),
        encoding: "base64",
        content: btoa("---\nrss: RSS\n---\n\n# \n\nHello\n"),
      }),
    );
    vi.stubGlobal("fetch", upstream);

    const response = await fetch("/api/pages/home");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      page: {
        name: "home",
        path: "Content/index.md",
        content: "---\nrss: RSS\n---\n\n# \n\nHello\n",
        sha: "a".repeat(40),
        githubUrl: "https://github.com/tanabe1478/blog/blob/main/Content/index.md",
        publicUrl: "https://tanabe1478.github.io/",
      },
    });
    expect(upstream).toHaveBeenCalledWith(
      "https://api.github.com/repos/tanabe1478/blog/contents/Content/index.md",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("updates the about page with its current SHA", async () => {
    const upstream = vi.fn().mockResolvedValue(
      Response.json({
        content: { sha: "b".repeat(40) },
        commit: { sha: "c".repeat(40) },
      }),
    );
    vi.stubGlobal("fetch", upstream);

    const response = await put("/api/pages/about", {
      content: "# tanabe1478\n",
      sha: "a".repeat(40),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      update: {
        sha: "b".repeat(40),
        commitSha: "c".repeat(40),
        githubUrl: "https://github.com/tanabe1478/blog/blob/main/Content/about.md",
      },
    });
    expect(upstream.mock.calls[0][0]).toBe(
      "https://api.github.com/repos/tanabe1478/blog/contents/Content/about.md",
    );
    expect(JSON.parse(upstream.mock.calls[0][1].body)).toEqual({
      message: "page: update about via CMS",
      content: btoa("# tanabe1478\n"),
      sha: "a".repeat(40),
      branch: "main",
    });
  });

  it("only serves the known pages", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await fetch("/api/pages/..%2F.github%2Fworkflows%2Fdeploy.yml");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "ページが見つかりません" });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects page writes from another origin", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await fetch("/api/pages/home", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ content: "# \n", sha: "a".repeat(40) }),
    });

    expect(response.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects an invalid page payload before calling GitHub", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await put("/api/pages/home", { content: "# \n", sha: "not-a-sha" });

    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("reports a conflict instead of overwriting a newer page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 409 })));

    const response = await put("/api/pages/home", { content: "# \n", sha: "a".repeat(40) });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "ページが他の場所で更新されています。再読み込みしてください",
    });
  });
});
