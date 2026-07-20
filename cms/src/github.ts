const POSTS_API_URL =
  "https://api.github.com/repos/tanabe1478/blog/contents/Content/posts";
const REPOSITORY_URL = "https://github.com/tanabe1478/blog";
const PUBLIC_BLOG_URL = "https://tanabe1478.github.io";
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const BLOG_DEPLOY_WORKFLOW_URL =
  "https://api.github.com/repos/tanabe1478/blog/actions/workflows/deploy-blog.yml/runs";
const POSTS_QUERY = `query BlogPosts {
  repository(owner: "tanabe1478", name: "blog") {
    object(expression: "main:Content/posts") {
      ... on Tree {
        entries {
          name
          type
          object {
            ... on Blob {
              text
            }
          }
        }
      }
    }
  }
}`;
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

interface GitHubTreeEntry {
  name?: unknown;
  type?: unknown;
  object?: { text?: unknown } | null;
}

interface GitHubWorkflowRun {
  status?: unknown;
  conclusion?: unknown;
  html_url?: unknown;
  updated_at?: unknown;
}

interface GitHubWorkflowRunsResult {
  workflow_runs?: unknown;
}

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

export type BlogDeploymentState =
  | "pending"
  | "running"
  | "published"
  | "failed";

export interface BlogDeployment {
  commitSha: string;
  state: BlogDeploymentState;
  runUrl?: string;
  updatedAt?: string;
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

export function isValidNewPostName(name: string): boolean {
  return (
    name !== "index.md" &&
    name.length <= 104 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(name)
  );
}

export function isValidNewPostContent(content: string): boolean {
  if (!isValidPostContent(content)) return false;
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return Boolean(
    frontmatter?.[1].match(
      /^date:\s*\d{4}-\d{2}-\d{2} \d{2}:\d{2}\s*$/m,
    ) && content.match(/^#\s+\S.*$/m),
  );
}

function githubFileUrl(path: string): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${REPOSITORY_URL}/blob/main/${encodedPath}`;
}

function publicPostUrl(name: string): string {
  return `${PUBLIC_BLOG_URL}/posts/${encodeURIComponent(name.slice(0, -3))}/`;
}

function postMetadata(name: string, content: string): PostSummary | undefined {
  if (name === "index.md") return undefined;
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const date = frontmatter?.[1].match(/^date:\s*(.+)\s*$/m)?.[1]?.trim();
  const title = content.match(/^#{1,6}\s+(.+)\s*$/m)?.[1]?.trim();
  if (!date || !title) return undefined;
  const path = `Content/posts/${name}`;
  return {
    name,
    title,
    date,
    path,
    githubUrl: githubFileUrl(path),
    publicUrl: publicPostUrl(name),
  };
}

function sortPosts(posts: PostSummary[]): PostSummary[] {
  return posts.sort(
    (left, right) =>
      right.date.localeCompare(left.date, "en") ||
      left.name.localeCompare(right.name, "en"),
  );
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

export async function getBlogDeployment(
  commitSha: string,
  token?: string,
  request: typeof fetch = fetch,
): Promise<BlogDeployment> {
  const query = new URLSearchParams({
    head_sha: commitSha,
    event: "push",
    per_page: "1",
  });
  const url = `${BLOG_DEPLOY_WORKFLOW_URL}?${query}`;
  let response = await request(url, {
    headers: githubHeaders(token),
  });
  if (token && (response.status === 401 || response.status === 403)) {
    response = await request(url, { headers: githubHeaders() });
  }
  if (!response.ok) {
    throw new Error(`GitHub Actions API returned ${response.status}`);
  }

  const result: GitHubWorkflowRunsResult = await response.json();
  if (!Array.isArray(result.workflow_runs)) {
    throw new Error("GitHub Actions API returned an unexpected response");
  }
  if (result.workflow_runs.length === 0) {
    return { commitSha, state: "pending" };
  }

  const run = result.workflow_runs[0] as GitHubWorkflowRun;
  if (typeof run.status !== "string") {
    throw new Error("GitHub Actions API returned an invalid workflow run");
  }
  const state: BlogDeploymentState =
    run.status === "completed"
      ? run.conclusion === "success"
        ? "published"
        : "failed"
      : run.status === "in_progress"
        ? "running"
        : "pending";
  const runUrl =
    typeof run.html_url === "string" &&
    run.html_url.startsWith("https://github.com/tanabe1478/blog/actions/runs/")
      ? run.html_url
      : undefined;
  const updatedAt =
    typeof run.updated_at === "string" ? run.updated_at : undefined;

  return {
    commitSha,
    state,
    ...(runUrl ? { runUrl } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

export async function listPosts(
  token?: string,
  request: typeof fetch = fetch,
): Promise<PostSummary[]> {
  if (token) {
    const response = await request(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: githubHeaders(token, true),
      body: JSON.stringify({ query: POSTS_QUERY }),
    });
    if (!response.ok) {
      throw new Error(`GitHub GraphQL API returned ${response.status}`);
    }

    const result: unknown = await response.json();
    const entries =
      typeof result === "object" &&
      result !== null &&
      "data" in result &&
      typeof result.data === "object" &&
      result.data !== null &&
      "repository" in result.data &&
      typeof result.data.repository === "object" &&
      result.data.repository !== null &&
      "object" in result.data.repository &&
      typeof result.data.repository.object === "object" &&
      result.data.repository.object !== null &&
      "entries" in result.data.repository.object
        ? result.data.repository.object.entries
        : undefined;
    if (!Array.isArray(entries)) {
      throw new Error("GitHub GraphQL API returned an unexpected response");
    }

    const posts = entries.flatMap((entry: GitHubTreeEntry) => {
      if (
        entry.type !== "blob" ||
        typeof entry.name !== "string" ||
        !entry.name.endsWith(".md") ||
        typeof entry.object?.text !== "string"
      ) {
        return [];
      }
      const metadata = postMetadata(entry.name, entry.object.text);
      return metadata ? [metadata] : [];
    });
    return sortPosts(posts);
  }

  const response = await request(POSTS_API_URL, {
    headers: githubHeaders(),
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
        entry.name !== "index.md" &&
        entry.name.endsWith(".md") &&
        typeof entry.path === "string" &&
        entry.path.startsWith("Content/posts/"),
    )
    .map((entry) => ({
      name: entry.name,
      title: entry.name.slice(0, -3),
      date: "",
      path: entry.path,
      githubUrl: githubFileUrl(entry.path),
      publicUrl: publicPostUrl(entry.name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
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
    publicUrl: publicPostUrl(name),
  };
}

export async function createPost(
  name: string,
  content: string,
  token: string,
  request: typeof fetch = fetch,
): Promise<PostCreation> {
  const path = `Content/posts/${name}`;
  const response = await request(`${POSTS_API_URL}/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: githubHeaders(token, true),
    body: JSON.stringify({
      message: `post: create ${name} via CMS`,
      content: encodeBase64Utf8(content),
      branch: "main",
    }),
  });

  if (response.status === 409 || response.status === 422) {
    throw new PostConflictError(name);
  }
  if (!response.ok) {
    throw new Error(`GitHub create API returned ${response.status}`);
  }

  const result: GitHubUpdateResult = await response.json();
  if (
    typeof result.content?.sha !== "string" ||
    !/^[0-9a-f]{40}$/.test(result.content.sha) ||
    typeof result.commit?.sha !== "string" ||
    !/^[0-9a-f]{40}$/.test(result.commit.sha)
  ) {
    throw new Error("GitHub create API returned an unexpected response");
  }

  return {
    name,
    sha: result.content.sha,
    commitSha: result.commit.sha,
    githubUrl: githubFileUrl(path),
    publicUrl: publicPostUrl(name),
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
