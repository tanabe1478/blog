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

export interface PostCreation extends PostUpdate {
  name: string;
  publicUrl: string;
}

export interface UploadedImage {
  imageUrl: string;
  permalinkUrl: string;
  markdown: string;
}

export interface PostRename extends PostCreation {}

export interface PostDeletion {
  commitSha: string;
}

export type DeploymentState = "pending" | "running" | "published" | "failed";

export interface BlogDeployment {
  commitSha: string;
  state: DeploymentState;
  runUrl?: string;
  updatedAt?: string;
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

export async function createPost(name: string, content: string): Promise<PostCreation> {
  const data = await responseJson<{ post: PostCreation }>(
    await fetch("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, content }),
    }),
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

export async function renamePost(
  name: string,
  newName: string,
  content: string,
  sha: string,
  confirmation: string,
): Promise<PostRename> {
  const data = await responseJson<{ rename: PostRename }>(
    await fetch(`/api/posts/${encodeURIComponent(name)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newName, content, sha, confirmation }),
    }),
  );
  return data.rename;
}

export async function deletePost(
  name: string,
  sha: string,
  confirmation: string,
): Promise<PostDeletion> {
  const data = await responseJson<{ deletion: PostDeletion }>(
    await fetch(`/api/posts/${encodeURIComponent(name)}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sha, confirmation }),
    }),
  );
  return data.deletion;
}

export async function fetchDeployment(commitSha: string): Promise<BlogDeployment> {
  const data = await responseJson<{ deployment: BlogDeployment }>(
    await fetch(`/api/deployments/${encodeURIComponent(commitSha)}`),
  );
  return data.deployment;
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  const form = new FormData();
  form.append("image", file);
  const data = await responseJson<{ image: UploadedImage }>(
    await fetch("/api/images", { method: "POST", body: form }),
  );
  return data.image;
}
