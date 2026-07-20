import { authenticateAccess, type Env } from "./access";
import {
  getPost,
  isValidPostContent,
  isValidPostName,
  listPosts,
  PostConflictError,
  PostNotFoundError,
  updatePost,
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

function postNameFromPath(pathname: string): string | undefined {
  try {
    const name = decodeURIComponent(pathname.slice("/api/posts/".length));
    return isValidPostName(name) ? name : undefined;
  } catch {
    return undefined;
  }
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
  async fetch(request, env): Promise<Response> {
    const bypassAccess =
      env.ACCESS_BYPASS === "true" || env.ACCESS_BYPASS === true;
    if (!bypassAccess) {
      try {
        await authenticateAccess(request, env);
      } catch {
        return json({ error: "Forbidden" }, 403);
      }
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return html(cmsPage);
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ service: "tanabe-blog-cms-api", status: "ok" });
    }

    if (request.method === "GET" && url.pathname === "/api/posts") {
      try {
        return json({ posts: await listPosts(env.GITHUB_TOKEN) });
      } catch (error) {
        console.error("Failed to load posts", error);
        return json({ error: "記事一覧を取得できませんでした" }, 502);
      }
    }

    if (url.pathname.startsWith("/api/posts/")) {
      const name = postNameFromPath(url.pathname);
      if (!name) {
        return json({ error: "記事名が不正です" }, 400);
      }

      if (request.method === "GET") {
        try {
          return json({ post: await getPost(name, env.GITHUB_TOKEN) });
        } catch (error) {
          if (error instanceof PostNotFoundError) {
            return json({ error: "記事が見つかりません" }, 404);
          }
          console.error("Failed to load post", error);
          return json({ error: "記事を取得できませんでした" }, 502);
        }
      }

      if (request.method === "PUT") {
        if (
          url.hostname !== env.WRITE_HOST ||
          request.headers.get("origin") !== url.origin
        ) {
          return json({ error: "Forbidden" }, 403);
        }
        if (!request.headers.get("content-type")?.startsWith("application/json")) {
          return json({ error: "JSONを送信してください" }, 415);
        }
        if (!env.GITHUB_TOKEN) {
          return json({ error: "保存機能が設定されていません" }, 503);
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "JSONが不正です" }, 400);
        }
        if (
          typeof payload !== "object" ||
          payload === null ||
          !("content" in payload) ||
          typeof payload.content !== "string" ||
          !("sha" in payload) ||
          typeof payload.sha !== "string" ||
          !/^[0-9a-f]{40}$/.test(payload.sha) ||
          !isValidPostContent(payload.content)
        ) {
          return json({ error: "保存内容が不正です" }, 400);
        }

        try {
          return json({
            update: await updatePost(
              name,
              payload.content,
              payload.sha,
              env.GITHUB_TOKEN,
            ),
          });
        } catch (error) {
          if (error instanceof PostConflictError) {
            return json(
              { error: "記事が他の場所で更新されています。再読み込みしてください" },
              409,
            );
          }
          if (error instanceof PostNotFoundError) {
            return json({ error: "記事が見つかりません" }, 404);
          }
          console.error("Failed to update post", error);
          return json({ error: "記事を保存できませんでした" }, 502);
        }
      }
    }

    return json({ error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
