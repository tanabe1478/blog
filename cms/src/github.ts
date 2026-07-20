const POSTS_API_URL =
  "https://api.github.com/repos/tanabe1478/blog/contents/Content/posts";
const REPOSITORY_URL = "https://github.com/tanabe1478/blog";
const MAX_POST_BYTES = 1_000_000;

interface GitHubContent {
  name?: unknown;
  path?: unknown;
  type?: unknown;
  sha?: unknown;
  content?: unknown;
  encoding?: unknown;
}

interface GitHubUpdateResult {
  content?: { sha?: unknown };
  commit?: { sha?: unknown };
}

export interface PostSummary {
  name: string;
  path: string;
  githubUrl: string;
}

export interface PostDocument extends PostSummary {
  content: string;
  sha: string;
}

export interface PostUpdate {
  sha: string;
  commitSha: string;
  githubUrl: string;
}

export class PostNotFoundError extends Error {}
export class PostConflictError extends Error {}

export function isValidPostName(name: string): boolean {
  return (
    name.length > 3 &&
    name.length <= 200 &&
    name.endsWith(".md") &&
    !name.startsWith(".") &&
    !name.includes("/") &&
    !name.includes("\\")
  );
}

export function isValidPostContent(content: string): boolean {
  return new TextEncoder().encode(content).byteLength <= MAX_POST_BYTES;
}

function githubFileUrl(path: string): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${REPOSITORY_URL}/blob/main/${encodedPath}`;
}

function githubHeaders(token?: string, json = false): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "tanabe-blog-cms",
    "x-github-api-version": "2022-11-28",
  };
  if (json) {
    headers["content-type"] = "application/json";
  }
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

function decodeBase64Utf8(value: string): string {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.byteLength > MAX_POST_BYTES) {
    throw new Error("Post is too large");
  }
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export async function listPosts(
  token?: string,
  request: typeof fetch = fetch,
): Promise<PostSummary[]> {
  const response = await request(POSTS_API_URL, {
    headers: githubHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}`);
  }

  const contents: unknown = await response.json();
  if (!Array.isArray(contents)) {
    throw new Error("GitHub API returned an unexpected response");
  }

  return contents
    .filter(
      (entry: GitHubContent): entry is GitHubContent & {
        name: string;
        path: string;
        type: "file";
      } =>
        entry.type === "file" &&
        typeof entry.name === "string" &&
        entry.name.endsWith(".md") &&
        typeof entry.path === "string" &&
        entry.path.startsWith("Content/posts/"),
    )
    .map((entry) => ({
      name: entry.name,
      path: entry.path,
      githubUrl: githubFileUrl(entry.path),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

export async function getPost(
  name: string,
  token?: string,
  request: typeof fetch = fetch,
): Promise<PostDocument> {
  const path = `Content/posts/${name}`;
  const response = await request(`${POSTS_API_URL}/${encodeURIComponent(name)}`, {
    headers: githubHeaders(token),
  });

  if (response.status === 404) {
    throw new PostNotFoundError(name);
  }
  if (!response.ok) {
    throw new Error(`GitHub content API returned ${response.status}`);
  }

  const post: GitHubContent = await response.json();
  if (
    post.type !== "file" ||
    typeof post.sha !== "string" ||
    !/^[0-9a-f]{40}$/.test(post.sha) ||
    post.encoding !== "base64" ||
    typeof post.content !== "string"
  ) {
    throw new Error("GitHub content API returned an unexpected response");
  }

  return {
    name,
    path,
    content: decodeBase64Utf8(post.content),
    sha: post.sha,
    githubUrl: githubFileUrl(path),
  };
}

export async function updatePost(
  name: string,
  content: string,
  sha: string,
  token: string,
  request: typeof fetch = fetch,
): Promise<PostUpdate> {
  const path = `Content/posts/${name}`;
  const response = await request(`${POSTS_API_URL}/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: githubHeaders(token, true),
    body: JSON.stringify({
      message: `post: update ${name} via CMS`,
      content: encodeBase64Utf8(content),
      sha,
      branch: "main",
    }),
  });

  if (response.status === 404) {
    throw new PostNotFoundError(name);
  }
  if (response.status === 409) {
    throw new PostConflictError(name);
  }
  if (!response.ok) {
    throw new Error(`GitHub update API returned ${response.status}`);
  }

  const result: GitHubUpdateResult = await response.json();
  if (
    typeof result.content?.sha !== "string" ||
    !/^[0-9a-f]{40}$/.test(result.content.sha) ||
    typeof result.commit?.sha !== "string" ||
    !/^[0-9a-f]{40}$/.test(result.commit.sha)
  ) {
    throw new Error("GitHub update API returned an unexpected response");
  }

  return {
    sha: result.content.sha,
    commitSha: result.commit.sha,
    githubUrl: githubFileUrl(path),
  };
}
