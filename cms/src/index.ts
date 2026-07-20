import { authenticateAccess, type Env } from "./access";
import {
  createPost,
  deletePost,
  getBlogDeployment,
  getPost,
  isValidNewPostContent,
  isValidNewPostName,
  isValidPostContent,
  isValidPostName,
  listPosts,
  PostConflictError,
  PostNotFoundError,
  updatePost,
} from "./github";
import {
  InvalidImageError,
  MAX_IMAGE_BYTES,
  uploadToGyazo,
} from "./gyazo";
import { cmsPage } from "./page";

function json(data: unknown, status = 200, cacheControl = "no-store"): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": cacheControl,
    },
  });
}

function isAllowedWriteRequest(request: Request, url: URL, env: Env): boolean {
  return (
    url.hostname === env.WRITE_HOST &&
    request.headers.get("origin") === url.origin
  );
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
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        "default-src 'none'; connect-src 'self'; img-src https: data:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
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

    if (request.method === "POST" && url.pathname === "/api/images") {
      if (!isAllowedWriteRequest(request, url, env)) {
        return json({ error: "Forbidden" }, 403);
      }
      if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
        return json({ error: "画像をmultipart/form-dataで送信してください" }, 415);
      }
      const declaredLength = Number(request.headers.get("content-length"));
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > MAX_IMAGE_BYTES + 1024 * 1024
      ) {
        return json({ error: "画像は10MB以下にしてください" }, 413);
      }
      if (!env.GYAZO_ACCESS_TOKEN) {
        return json({ error: "画像アップロードが設定されていません" }, 503);
      }

      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return json({ error: "画像フォームが不正です" }, 400);
      }
      const image = form.get("image");
      if (!(image instanceof File)) {
        return json({ error: "画像ファイルを選択してください" }, 400);
      }

      try {
        return json({
          image: await uploadToGyazo(image, env.GYAZO_ACCESS_TOKEN),
        });
      } catch (error) {
        if (error instanceof InvalidImageError) {
          return json(
            { error: "PNG・JPEG・GIF・WebPの10MB以下の画像を選択してください" },
            400,
          );
        }
        console.error("Failed to upload image", error);
        return json({ error: "画像をGyazoへアップロードできませんでした" }, 502);
      }
    }

    if (
      request.method === "GET" &&
      url.pathname.startsWith("/api/deployments/")
    ) {
      const commitSha = url.pathname.slice("/api/deployments/".length);
      if (!/^[0-9a-f]{40}$/.test(commitSha)) {
        return json({ error: "commit SHAが不正です" }, 400);
      }
      try {
        return json({
          deployment: await getBlogDeployment(commitSha, env.GITHUB_TOKEN),
        });
      } catch (error) {
        console.error("Failed to load deployment status", error);
        return json({ error: "公開状況を取得できませんでした" }, 502);
      }
    }

    if (url.pathname === "/api/posts") {
      if (request.method === "GET") {
        try {
          return json({ posts: await listPosts(env.GITHUB_TOKEN) });
        } catch (error) {
          console.error("Failed to load posts", error);
          return json({ error: "記事一覧を取得できませんでした" }, 502);
        }
      }

      if (request.method === "POST") {
        if (!isAllowedWriteRequest(request, url, env)) {
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
          !("name" in payload) ||
          typeof payload.name !== "string" ||
          !isValidNewPostName(payload.name) ||
          !("content" in payload) ||
          typeof payload.content !== "string" ||
          !isValidNewPostContent(payload.content)
        ) {
          return json({ error: "新規記事の内容が不正です" }, 400);
        }

        try {
          return json(
            {
              post: await createPost(
                payload.name,
                payload.content,
                env.GITHUB_TOKEN,
              ),
            },
            201,
          );
        } catch (error) {
          if (error instanceof PostConflictError) {
            return json({ error: "同じslugの記事が既に存在します" }, 409);
          }
          console.error("Failed to create post", error);
          return json({ error: "記事を作成できませんでした" }, 502);
        }
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
        if (!isAllowedWriteRequest(request, url, env)) {
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

      if (request.method === "DELETE") {
        if (!isAllowedWriteRequest(request, url, env)) {
          return json({ error: "Forbidden" }, 403);
        }
        if (!request.headers.get("content-type")?.startsWith("application/json")) {
          return json({ error: "JSONを送信してください" }, 415);
        }
        if (!env.GITHUB_TOKEN) {
          return json({ error: "削除機能が設定されていません" }, 503);
        }
        if (name === "index.md") {
          return json({ error: "記事一覧のindexは削除できません" }, 400);
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
          !("sha" in payload) ||
          typeof payload.sha !== "string" ||
          !/^[0-9a-f]{40}$/.test(payload.sha) ||
          !("confirmation" in payload) ||
          payload.confirmation !== name
        ) {
          return json({ error: "削除確認の内容が不正です" }, 400);
        }

        try {
          return json({
            deletion: await deletePost(
              name,
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
          console.error("Failed to delete post", error);
          return json({ error: "記事を削除できませんでした" }, 502);
        }
      }
    }

    return json({ error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
