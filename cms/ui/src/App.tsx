import { useEffect, useState, type FormEvent } from "react";

import { ArticleWorkspace, type InitialDeployment } from "./ArticleWorkspace";
import { fetchPost, fetchPosts, type PostDocument, type PostSummary } from "./api";
import { readDraft, writeDraft, type LocalDraft } from "./drafts";

type Loadable<T> =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; value: T };

type CmsRoute =
  | { view: "list" }
  | { view: "post"; name: string }
  | { view: "draft"; name: string };

interface StartedDraft {
  draft: LocalDraft;
  stored: boolean;
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function currentRoute(): CmsRoute {
  const search = new URLSearchParams(window.location.search);
  const post = search.get("post");
  if (post) return { view: "post", name: post };
  const draft = search.get("draft");
  if (draft) return { view: "draft", name: draft };
  return { view: "list" };
}

function useCmsRoute() {
  const [route, setRoute] = useState<CmsRoute>(currentRoute);

  useEffect(() => {
    const onPopState = () => setRoute(currentRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (next: CmsRoute, replace = false) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("post");
    url.searchParams.delete("draft");
    if (next.view === "post") url.searchParams.set("post", next.name);
    if (next.view === "draft") url.searchParams.set("draft", next.name);
    window.history[replace ? "replaceState" : "pushState"](null, "", url);
    setRoute(next);
  };

  return [route, navigate] as const;
}

function localDateTimeValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function NewPostForm({ onStart, onClose }: {
  onStart: (started: StartedDraft) => void;
  onClose: () => void;
}) {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(localDateTimeValue);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("日記");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const name = `${slug}.md`;
    const normalizedTags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .join(", ") || "日記";
    const content = [
      "---",
      `date: ${date.replace("T", " ")}`,
      `description: ${JSON.stringify(description.trim())}`,
      `tags: ${normalizedTags}`,
      "---",
      "",
      `# ${title.trim()}`,
      "",
      "",
    ].join("\n");
    const draft: LocalDraft = {
      version: 1,
      name,
      content,
      baseSha: null,
      isNew: true,
      savedAt: new Date().toISOString(),
    };
    onStart({ draft, stored: writeDraft(draft) });
  };

  return (
    <form className="new-post-form" onSubmit={submit}>
      <label>
        slug
        <input
          name="slug"
          value={slug}
          required
          maxLength={100}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="my-new-post"
          autoComplete="off"
          onChange={(event) => setSlug(event.target.value)}
        />
      </label>
      <label>
        タイトル
        <input name="title" value={title} required onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        公開日時
        <input
          name="date"
          type="datetime-local"
          value={date}
          required
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <label>
        説明
        <input
          name="description"
          value={description}
          maxLength={300}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label>
        タグ（comma区切り）
        <input name="tags" value={tags} onChange={(event) => setTags(event.target.value)} />
      </label>
      <div className="form-actions">
        <button className="primary" type="submit">記事を書き始める</button>
        <button type="button" onClick={onClose}>フォームを閉じる</button>
      </div>
    </form>
  );
}

function PostList({
  onSelect,
  onStartDraft,
}: {
  onSelect: (name: string) => void;
  onStartDraft: (started: StartedDraft) => void;
}) {
  const [posts, setPosts] = useState<Loadable<PostSummary[]>>({ state: "loading" });
  const [showNewPost, setShowNewPost] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchPosts(controller.signal).then(
      (value) => setPosts({ state: "ready", value }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setPosts({ state: "error", message: message(error, "記事一覧を取得できませんでした") });
        }
      },
    );
    return () => controller.abort();
  }, []);

  return (
    <section className="panel" aria-labelledby="posts-heading">
      <div className="section-heading">
        <h2 id="posts-heading">記事一覧</h2>
        <div className="heading-actions">
          {!showNewPost && (
            <button className="primary" type="button" onClick={() => setShowNewPost(true)}>
              新規記事
            </button>
          )}
          <span className="migration-badge">React</span>
        </div>
      </div>
      {showNewPost && (
        <NewPostForm onStart={onStartDraft} onClose={() => setShowNewPost(false)} />
      )}
      {posts.state === "loading" && <p role="status">GitHubから取得しています…</p>}
      {posts.state === "error" && <p role="alert" className="error-message">{posts.message}</p>}
      {posts.state === "ready" && (
        <>
          <p role="status">{posts.value.length}件の記事</p>
          <ul className="post-list">
            {posts.value.map((post) => (
              <li key={post.name}>
                <button className="post-link" type="button" onClick={() => onSelect(post.name)}>
                  <span className="post-title">{post.title}</span>
                  <code className="post-meta">
                    {post.date ? `${post.date} · ${post.name}` : post.name}
                  </code>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function PostDetail({
  name,
  initialDeployment,
  onBack,
  onRenamed,
}: {
  name: string;
  initialDeployment?: InitialDeployment;
  onBack: () => void;
  onRenamed: (name: string, deployment: InitialDeployment) => void;
}) {
  const [post, setPost] = useState<Loadable<PostDocument>>({ state: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setPost({ state: "loading" });
    fetchPost(name, controller.signal).then(
      (value) => {
        document.title = `${value.name} - Blog CMS`;
        setPost({ state: "ready", value });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setPost({ state: "error", message: message(error, "記事を取得できませんでした") });
        }
      },
    );
    return () => controller.abort();
  }, [name]);

  return (
    <>
      <button className="back-button" type="button" onClick={onBack}>← 記事一覧へ</button>
      <section className="panel" aria-labelledby="post-heading">
        <h2 id="post-heading">{name}</h2>
        {post.state === "loading" && <p role="status">Markdownを取得しています…</p>}
        {post.state === "error" && <p role="alert" className="error-message">{post.message}</p>}
        {post.state === "ready" && (
          <>
            <p className="source-path">{post.value.path}</p>
            <ArticleWorkspace
              initialPost={post.value}
              initialDraft={readDraft(name)}
              initialDeployment={initialDeployment}
              onRenamed={onRenamed}
            />
          </>
        )}
      </section>
    </>
  );
}

function NewDraftDetail({
  name,
  started,
  onCreated,
  onDiscard,
}: {
  name: string;
  started?: StartedDraft;
  onCreated: (name: string, deployment: InitialDeployment) => void;
  onDiscard: () => void;
}) {
  const draft = started?.draft ?? readDraft(name);

  useEffect(() => {
    document.title = `${name} - Blog CMS`;
  }, [name]);

  return (
    <section className="panel" aria-labelledby="post-heading">
      <h2 id="post-heading">{name}</h2>
      {!draft || !draft.isNew ? (
        <p role="alert" className="error-message">
          この端末に復元できる新規記事の下書きがありません。
        </p>
      ) : (
        <ArticleWorkspace
          initialPost={{
            name,
            path: `Content/posts/${name}`,
            content: "",
            sha: "",
            githubUrl: "",
            publicUrl: "",
          }}
          initialDraft={draft}
          isNew
          startEditing={Boolean(started)}
          initialDraftStored={started?.stored}
          onCreated={onCreated}
          onDiscardNew={onDiscard}
        />
      )}
    </section>
  );
}

export function App() {
  const [route, navigate] = useCmsRoute();
  const [startedDraft, setStartedDraft] = useState<StartedDraft>();
  const [initialDeployment, setInitialDeployment] = useState<
    { name: string; deployment: InitialDeployment } | undefined
  >();

  useEffect(() => {
    if (route.view === "list") document.title = "Blog CMS";
  }, [route]);

  const startDraft = (started: StartedDraft) => {
    setStartedDraft(started);
    navigate({ view: "draft", name: started.draft.name });
  };

  const showPost = (name: string) => {
    setStartedDraft(undefined);
    setInitialDeployment(undefined);
    navigate({ view: "post", name });
  };

  const showChangedPost = (name: string, deployment: InitialDeployment) => {
    setStartedDraft(undefined);
    setInitialDeployment({ name, deployment });
    navigate({ view: "post", name }, true);
  };

  const showList = () => {
    setStartedDraft(undefined);
    setInitialDeployment(undefined);
    navigate({ view: "list" });
  };

  return (
    <>
      <header className="site-header">
        <h1>Blog CMS</h1>
        <span className="badge">GitHub連携</span>
      </header>
      <main className="site-main">
        {route.view === "post" && (
          <PostDetail
            name={route.name}
            initialDeployment={
              initialDeployment?.name === route.name ? initialDeployment.deployment : undefined
            }
            onBack={showList}
            onRenamed={showChangedPost}
          />
        )}
        {route.view === "draft" && (
          <NewDraftDetail
            name={route.name}
            started={startedDraft?.draft.name === route.name ? startedDraft : undefined}
            onCreated={showChangedPost}
            onDiscard={showList}
          />
        )}
        {route.view === "list" && (
          <PostList onSelect={showPost} onStartDraft={startDraft} />
        )}
      </main>
    </>
  );
}
