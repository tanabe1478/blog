import { fetchPost, type PostDocument } from "./api";

type PostEntry =
  | { state: "pending"; promise: Promise<void> }
  | { state: "ready"; post: PostDocument }
  | { state: "error"; error: Error };

const posts = new Map<string, PostEntry>();

function loadPost(name: string): PostEntry {
  const existing = posts.get(name);
  if (existing) return existing;

  const promise = fetchPost(name).then(
    (post) => {
      posts.set(name, { state: "ready", post });
    },
    (cause: unknown) => {
      posts.set(name, {
        state: "error",
        error: cause instanceof Error ? cause : new Error("記事を取得できませんでした"),
      });
    },
  );
  const pending: PostEntry = { state: "pending", promise };
  posts.set(name, pending);
  return pending;
}

export function preloadPost(name: string): void {
  loadPost(name);
}

export function readPost(name: string): PostDocument {
  const entry = loadPost(name);
  if (entry.state === "pending") throw entry.promise;
  if (entry.state === "error") throw entry.error;
  return entry.post;
}

export function setCachedPost(post: PostDocument): void {
  posts.set(post.name, { state: "ready", post });
}

export function invalidatePost(name: string): void {
  posts.delete(name);
}
