const POSTS_API_URL =
  "https://api.github.com/repos/tanabe1478/blog/contents/Content/posts";
const REPOSITORY_URL = "https://github.com/tanabe1478/blog";
const RAW_POSTS_URL =
  "https://raw.githubusercontent.com/tanabe1478/blog/main/Content/posts";
const MAX_POST_BYTES = 1_000_000;

interface GitHubContent {
  name?: unknown;
  path?: unknown;
  type?: unknown;
}

export interface PostSummary {
  name: string;
  path: string;
  githubUrl: string;
}

export interface PostDocument extends PostSummary {
  content: string;
}

export class PostNotFoundError extends Error {}

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

function githubFileUrl(path: string): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${REPOSITORY_URL}/blob/main/${encodedPath}`;
}

export async function listPosts(
  request: typeof fetch = fetch,
): Promise<PostSummary[]> {
  const response = await request(POSTS_API_URL, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "tanabe-blog-cms",
      "x-github-api-version": "2022-11-28",
    },
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
  request: typeof fetch = fetch,
): Promise<PostDocument> {
  const path = `Content/posts/${name}`;
  const response = await request(`${RAW_POSTS_URL}/${encodeURIComponent(name)}`, {
    headers: {
      accept: "text/plain",
      "user-agent": "tanabe-blog-cms",
    },
  });

  if (response.status === 404) {
    throw new PostNotFoundError(name);
  }
  if (!response.ok) {
    throw new Error(`GitHub raw content returned ${response.status}`);
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_POST_BYTES) {
    throw new Error("Post is too large");
  }

  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_POST_BYTES) {
    throw new Error("Post is too large");
  }

  return {
    name,
    path,
    content: new TextDecoder().decode(body),
    githubUrl: githubFileUrl(path),
  };
}
