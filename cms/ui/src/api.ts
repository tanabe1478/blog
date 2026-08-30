export interface PostSummary {
  name: string;
  title: string;
  date: string;
  path: string;
  githubUrl: string;
  publicUrl: string;
}

export interface PostDocument {
  name: string;
  path: string;
  content: string;
  sha: string;
  githubUrl: string;
  publicUrl: string;
}

async function responseJson<T>(response: Response): Promise<T> {
  const data: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "CMS API request failed";
    throw new Error(message);
  }
  return data as T;
}

export async function fetchPosts(signal?: AbortSignal): Promise<PostSummary[]> {
  const data = await responseJson<{ posts: PostSummary[] }>(
    await fetch("/api/posts", { signal }),
  );
  return data.posts;
}

export async function fetchPost(
  name: string,
  signal?: AbortSignal,
): Promise<PostDocument> {
  const data = await responseJson<{ post: PostDocument }>(
    await fetch(`/api/posts/${encodeURIComponent(name)}`, { signal }),
  );
  return data.post;
}
