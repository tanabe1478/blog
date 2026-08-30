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

export interface PostUpdate {
  sha: string;
  commitSha: string;
  githubUrl: string;
}

export interface UploadedImage {
  imageUrl: string;
  permalinkUrl: string;
  markdown: string;
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

export async function updatePost(
  name: string,
  content: string,
  sha: string,
): Promise<PostUpdate> {
  const data = await responseJson<{ update: PostUpdate }>(
    await fetch(`/api/posts/${encodeURIComponent(name)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content, sha }),
    }),
  );
  return data.update;
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  const form = new FormData();
  form.append("image", file);
  const data = await responseJson<{ image: UploadedImage }>(
    await fetch("/api/images", { method: "POST", body: form }),
  );
  return data.image;
}
