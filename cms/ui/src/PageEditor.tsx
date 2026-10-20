import { useEffect, useState } from "react";

import { fetchPage, updatePage, type PageDocument, type PageName } from "./api";
import { DeploymentStatus } from "./DeploymentStatus";
import {
  joinHeading,
  readFrontmatterValue,
  setFrontmatterValue,
  splitHeading,
} from "./frontmatter";
import { MarkdownArticle } from "./MarkdownArticle";

interface PageField {
  key: string;
  label: string;
  help: string;
}

// Which parts of each page get their own input. Everything else stays in the body.
const PAGES: Record<PageName, { title: string; heading: boolean; fields: PageField[] }> = {
  home: {
    title: "Home",
    heading: false,
    fields: [
      { key: "profile", label: "プロフィール", help: "ヘッダー下の Profile に表示します。" },
      { key: "rss", label: "RSSの案内", help: "Recent の下の RSS 欄に表示します。" },
    ],
  },
  about: {
    title: "About",
    heading: true,
    fields: [{ key: "subtitle", label: "サブタイトル", help: "タイトルの下に表示します。" }],
  },
};

interface PageValues {
  fields: Record<string, string>;
  heading: string;
  body: string;
}

function valuesOf(name: PageName, content: string): PageValues {
  const fields = Object.fromEntries(
    PAGES[name].fields.map((field) => [field.key, readFrontmatterValue(content, field.key)]),
  );
  return { fields, ...splitHeading(content) };
}

// Rewrites only the parts that changed, so untouched lines keep their original form.
function compose(name: PageName, source: string, values: PageValues): string {
  const original = valuesOf(name, source);
  let next = source;
  for (const field of PAGES[name].fields) {
    const value = values.fields[field.key].trim();
    if (value !== original.fields[field.key]) {
      next = setFrontmatterValue(next, field.key, value || null);
    }
  }
  const body = values.body === "" || values.body.endsWith("\n") ? values.body : `${values.body}\n`;
  if (values.heading.trim() !== original.heading || body !== original.body) {
    next = joinHeading(next, values.heading, body);
  }
  return next;
}

function PageForm({ initialPage }: { initialPage: PageDocument }) {
  const name = initialPage.name;
  const config = PAGES[name];
  const [page, setPage] = useState(initialPage);
  const [values, setValues] = useState(() => valuesOf(name, initialPage.content));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [commitSha, setCommitSha] = useState<string>();

  const content = compose(name, page.content, values);
  const changed = content !== page.content;

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (changed) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [changed]);

  const save = async () => {
    setSaving(true);
    setError(false);
    setStatus("GitHubへ保存しています…");
    try {
      const update = await updatePage(name, content, page.sha);
      setPage({ ...page, content, sha: update.sha, githubUrl: update.githubUrl });
      setCommitSha(update.commitSha);
      setStatus("GitHubへ保存しました。公開処理はGitHub Actionsで進みます。");
    } catch (cause) {
      setError(true);
      setStatus(cause instanceof Error ? cause.message : "ページを保存できませんでした。");
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: string, value: string) =>
    setValues((current) => ({ ...current, fields: { ...current.fields, [key]: value } }));

  return (
    <>
      <div className="page-fields">
        {config.heading && (
          <label>
            タイトル
            <input
              name="heading"
              value={values.heading}
              required
              readOnly={saving}
              onChange={(event) => setValues({ ...values, heading: event.target.value })}
            />
          </label>
        )}
        {config.fields.map((field) => (
          <label key={field.key}>
            {field.label}
            <input
              name={field.key}
              value={values.fields[field.key]}
              readOnly={saving}
              onChange={(event) => setField(field.key, event.target.value)}
            />
            <span className="field-help">{field.help}</span>
          </label>
        ))}
      </div>

      {status && (
        <p className={error ? "error-message" : "workspace-status"} role={error ? "alert" : "status"}>
          {status}
        </p>
      )}

      <div className="editor-grid">
        <textarea
          className="markdown-editor"
          aria-label="本文（Markdown）"
          value={values.body}
          readOnly={saving}
          onChange={(event) => setValues({ ...values, body: event.target.value })}
        />
        <MarkdownArticle
          content={config.heading ? `# ${values.heading}\n\n${values.body}` : values.body}
        />
      </div>

      <div className="workspace-actions">
        <button className="primary" type="button" disabled={!changed || saving} onClick={save}>
          {saving ? "保存中…" : "ページをGitHubへ保存"}
        </button>
        <nav className="detail-links" aria-label="ページリンク">
          <a href={page.publicUrl} target="_blank" rel="noreferrer">公開ページを開く</a>
          <a href={page.githubUrl} target="_blank" rel="noreferrer">GitHubで元ファイルを開く</a>
        </nav>
      </div>

      {commitSha && <DeploymentStatus commitSha={commitSha} purpose="publish" />}
    </>
  );
}

type PageState =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; page: PageDocument };

export function PageEditor({ name, onBack }: { name: PageName; onBack: () => void }) {
  const [page, setPage] = useState<PageState>({ state: "loading" });

  useEffect(() => {
    document.title = `${PAGES[name].title} - Blog CMS`;
    const controller = new AbortController();
    setPage({ state: "loading" });
    fetchPage(name, controller.signal).then(
      (value) => setPage({ state: "ready", page: value }),
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        setPage({
          state: "error",
          message: cause instanceof Error ? cause.message : "ページを取得できませんでした",
        });
      },
    );
    return () => controller.abort();
  }, [name]);

  return (
    <>
      <button className="back-button" type="button" onClick={onBack}>← 記事一覧へ</button>
      <section className="panel" aria-labelledby="page-heading">
        <h2 id="page-heading">{PAGES[name].title}</h2>
        {page.state === "loading" && <p role="status">GitHubから取得しています…</p>}
        {page.state === "error" && <p role="alert" className="error-message">{page.message}</p>}
        {page.state === "ready" && (
          <>
            <p className="source-path">{page.page.path}</p>
            <PageForm key={page.page.sha} initialPage={page.page} />
          </>
        )}
      </section>
    </>
  );
}
