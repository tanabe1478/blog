import { useEffect, useState } from "react";

import { fetchPost, fetchPosts, type PostDocument, type PostSummary } from "./api";
import { MarkdownArticle } from "./MarkdownArticle";

type Loadable<T> =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; value: T };

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function useSelectedPost() {
  const [selected, setSelected] = useState(
    () => new URLSearchParams(window.location.search).get("post"),
  );

  useEffect(() => {
    const onPopState = () => {
      setSelected(new URLSearchParams(window.location.search).get("post"));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const select = (name: string | null) => {
    const url = new URL(window.location.href);
    if (name) url.searchParams.set("post", name);
    else url.searchParams.delete("post");
    window.history.pushState(null, "", url);
    setSelected(name);
  };

  return [selected, select] as const;
}

function PostList({ onSelect }: { onSelect: (name: string) => void }) {
  const [posts, setPosts] = useState<Loadable<PostSummary[]>>({
    state: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchPosts(controller.signal).then(
      (value) => setPosts({ state: "ready", value }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setPosts({
            state: "error",
            message: message(error, "記事一覧を取得できませんでした"),
          });
        }
      },
    );
    return () => controller.abort();
  }, []);

  return (
    <section className="panel" aria-labelledby="posts-heading">
      <div className="section-heading">
        <h2 id="posts-heading">記事一覧</h2>
        <span className="migration-badge">React</span>
      </div>
      {posts.state === "loading" && <p role="status">GitHubから取得しています…</p>}
      {posts.state === "error" && (
        <p role="alert" className="error-message">
          {posts.message}
        </p>
      )}
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

function PostDetail({ name, onBack }: { name: string; onBack: () => void }) {
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
          setPost({
            state: "error",
            message: message(error, "記事を取得できませんでした"),
          });
        }
      },
    );
    return () => controller.abort();
  }, [name]);

  return (
    <>
      <button className="back-button" type="button" onClick={onBack}>
        ← 記事一覧へ
      </button>
      <section className="panel" aria-labelledby="post-heading">
        <h2 id="post-heading">{name}</h2>
        {post.state === "loading" && <p role="status">Markdownを取得しています…</p>}
        {post.state === "error" && (
          <p role="alert" className="error-message">
            {post.message}
          </p>
        )}
        {post.state === "ready" && (
          <>
            <p className="source-path">{post.value.path}</p>
            <MarkdownArticle content={post.value.content} />
            <nav className="detail-links" aria-label="記事リンク">
              <a href={post.value.publicUrl} target="_blank" rel="noreferrer">
                公開ページを開く
              </a>
              <a href={post.value.githubUrl} target="_blank" rel="noreferrer">
                GitHubで元ファイルを開く
              </a>
            </nav>
          </>
        )}
      </section>
    </>
  );
}

export function App() {
  const [selectedPost, selectPost] = useSelectedPost();

  useEffect(() => {
    if (!selectedPost) document.title = "Blog CMS";
  }, [selectedPost]);

  return (
    <>
      <header className="site-header">
        <h1>Blog CMS</h1>
        <span className="badge">GitHub連携</span>
      </header>
      <main className="site-main">
        {selectedPost ? (
          <PostDetail name={selectedPost} onBack={() => selectPost(null)} />
        ) : (
          <PostList onSelect={selectPost} />
        )}
      </main>
    </>
  );
}
