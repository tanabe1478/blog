import { describe, expect, it } from "vitest";

import worker from "../src/index";

function fetch(path: string, init?: RequestInit): Promise<Response> {
  const request = new Request(`https://cms.example.test${path}`, init);
  return worker.fetch(request as Parameters<typeof worker.fetch>[0]);
}

describe("CMS Worker", () => {
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
