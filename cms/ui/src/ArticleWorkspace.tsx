import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import { updatePost, uploadImage, type PostDocument } from "./api";
import { MarkdownArticle } from "./MarkdownArticle";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

interface ArticleWorkspaceProps {
  initialPost: PostDocument;
}

export function ArticleWorkspace({ initialPost }: ArticleWorkspaceProps) {
  const [post, setPost] = useState(initialPost);
  const [content, setContent] = useState(initialPost.content);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const changed = content !== post.content;

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!editing || !changed) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [changed, editing]);

  const beginEditing = () => {
    setError(false);
    setStatus("編集中です。保存するとGitHubのmainブランチへ反映されます。");
    setEditing(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const cancelEditing = () => {
    if (changed && !window.confirm("変更を破棄しますか？")) return;
    setContent(post.content);
    setEditing(false);
    setError(false);
    setStatus(changed ? "変更を破棄しました。" : "");
  };

  const save = async () => {
    setSaving(true);
    setError(false);
    setStatus("GitHubへ保存しています…");
    try {
      const update = await updatePost(post.name, content, post.sha);
      setPost({
        ...post,
        content,
        sha: update.sha,
        githubUrl: update.githubUrl,
      });
      setEditing(false);
      setStatus("GitHubへ保存しました。公開処理はGitHub Actionsで進みます。");
    } catch (cause) {
      setError(true);
      setStatus(cause instanceof Error ? cause.message : "記事を保存できませんでした。");
    } finally {
      setSaving(false);
    }
  };

  const insertUploadedImage = async (file: File) => {
    if (uploading) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError(true);
      setStatus("画像は10MB以下にしてください。");
      return;
    }

    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? start;
    setUploading(true);
    setError(false);
    setStatus("Gyazoへアップロードしています…");
    try {
      const image = await uploadImage(file);
      const before = content.slice(0, start);
      const after = content.slice(end);
      const leadingNewline = before && !before.endsWith("\n") ? "\n" : "";
      const trailingNewline = after && !after.startsWith("\n") ? "\n" : "";
      const inserted = `${leadingNewline}${image.markdown}${trailingNewline}`;
      const nextContent = before + inserted + after;
      const nextCursor = before.length + inserted.length;
      setContent(nextContent);
      setStatus("Gyazo画像を挿入しました。GitHubへ保存してください。");
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      });
    } catch (cause) {
      setError(true);
      setStatus(cause instanceof Error ? cause.message : "画像をアップロードできませんでした。");
    } finally {
      setUploading(false);
    }
  };

  const selectImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await insertUploadedImage(file);
    event.target.value = "";
  };

  const dropImage = async (event: DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length !== 1) {
      setError(true);
      setStatus("画像は1枚ずつドロップしてください。");
      return;
    }
    await insertUploadedImage(files[0]);
  };

  return (
    <>
      {status && (
        <p className={error ? "error-message" : "workspace-status"} role={error ? "alert" : "status"}>
          {status}
        </p>
      )}

      {editing ? (
        <div className="editor-grid">
          <textarea
            ref={textareaRef}
            className={dragging ? "markdown-editor dragging" : "markdown-editor"}
            aria-label="Markdown本文"
            value={content}
            readOnly={saving}
            onChange={(event) => setContent(event.target.value)}
            onDragEnter={(event) => {
              if (event.dataTransfer.types.includes("Files")) {
                event.preventDefault();
                setDragging(true);
              }
            }}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes("Files")) event.preventDefault();
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={dropImage}
          />
          <MarkdownArticle content={content} />
        </div>
      ) : (
        <MarkdownArticle content={post.content} />
      )}

      <div className="workspace-actions">
        {editing ? (
          <>
            <button className="primary" type="button" disabled={saving || uploading} onClick={save}>
              {saving ? "保存中…" : "GitHubへ保存"}
            </button>
            <button type="button" disabled={saving || uploading} onClick={cancelEditing}>
              キャンセル
            </button>
            <button type="button" disabled={saving || uploading} onClick={() => imageInputRef.current?.click()}>
              {uploading ? "画像をアップロード中…" : "画像を選択 / ドロップ"}
            </button>
            <input
              ref={imageInputRef}
              className="visually-hidden"
              aria-label="画像ファイル"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={selectImage}
            />
          </>
        ) : (
          <button type="button" onClick={beginEditing}>
            編集
          </button>
        )}
        <nav className="detail-links" aria-label="記事リンク">
          <a href={post.publicUrl} target="_blank" rel="noreferrer">
            公開ページを開く
          </a>
          <a href={post.githubUrl} target="_blank" rel="noreferrer">
            GitHubで元ファイルを開く
          </a>
        </nav>
      </div>
    </>
  );
}
