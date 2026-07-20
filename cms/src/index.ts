function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ service: "tanabe-blog-cms-api", status: "ok" });
    }

    return json({ error: "Not found" }, 404);
  },
} satisfies ExportedHandler;
