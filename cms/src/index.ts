import {
  getPost,
  isValidPostName,
  listPosts,
  PostNotFoundError,
} from "./github";
import { cmsPage } from "./page";

function json(data: unknown, status = 200, cacheControl = "no-store"): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": cacheControl,
    },
  });
}

function html(content: string): Response {
  return new Response(content, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        "default-src 'none'; connect-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

export default {
  async fetch(request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return html(cmsPage);
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ service: "tanabe-blog-cms-api", status: "ok" });
    }

    if (request.method === "GET" && url.pathname === "/api/posts") {
      try {
        return json({ posts: await listPosts() }, 200, "public, max-age=60");
      } catch (error) {
        console.error("Failed to load posts", error);
        return json({ error: "記事一覧を取得できませんでした" }, 502);
      }
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/posts/")) {
      let name: string;
      try {
        name = decodeURIComponent(url.pathname.slice("/api/posts/".length));
      } catch {
        return json({ error: "記事名が不正です" }, 400);
      }

      if (!isValidPostName(name)) {
        return json({ error: "記事名が不正です" }, 400);
      }

      try {
        return json({ post: await getPost(name) }, 200, "public, max-age=60");
      } catch (error) {
        if (error instanceof PostNotFoundError) {
          return json({ error: "記事が見つかりません" }, 404);
        }
        console.error("Failed to load post", error);
        return json({ error: "記事を取得できませんでした" }, 502);
      }
    }

    return json({ error: "Not found" }, 404);
  },
} satisfies ExportedHandler;
