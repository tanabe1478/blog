import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";

import {
  createPost,
  deletePost,
  renamePost,
  updatePost,
  uploadImage,
  type PostDocument,
} from "./api";
import { DeploymentStatus, type DeploymentPurpose } from "./DeploymentStatus";
import { removeDraft, writeDraft, type LocalDraft } from "./drafts";
import { MarkdownArticle } from "./MarkdownArticle";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface InitialDeployment {
  commitSha: string;
  purpose: DeploymentPurpose;
}

interface ArticleWorkspaceProps {
  initialPost: PostDocument;
  initialDraft?: LocalDraft;
  initialDeployment?: InitialDeployment;
  isNew?: boolean;
  startEditing?: boolean;
  initialDraftStored?: boolean;
  onCreated?: (name: string, deployment: InitialDeployment) => void;
  onRenamed?: (name: string, deployment: InitialDeployment) => void;
  onDiscardNew?: () => void;
}

export function ArticleWorkspace({
  initialPost,
  initialDraft,
  initialDeployment,
  isNew = false,
  startEditing = false,
  initialDraftStored = true,
  onCreated,
  onRenamed,
  onDiscardNew,
}: ArticleWorkspaceProps) {
  const [post, setPost] = useState(initialPost);
  const [creating, setCreating] = useState(isNew);
  const [content, setContent] = useState(
    startEditing && initialDraft ? initialDraft.content : initialPost.content,
  );
  const [baseSha, setBaseSha] = useState(
    startEditing && initialDraft ? (initialDraft.baseSha ?? "") : initialPost.sha,
  );
  const [pendingDraft, setPendingDraft] = useState<LocalDraft | undefined>(
    startEditing ? undefined : initialDraft,
  );
  const [editing, setEditing] = useState(startEditing);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [operation, setOperation] = useState<"rename" | "delete">();
  const [operationBusy, setOperationBusy] = useState(false);
  const [renameSlug, setRenameSlug] = useState(initialPost.name.slice(0, -3));
  const [renameConfirmation, setRenameConfirmation] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleted, setDeleted] = useState(false);
  const [deployment, setDeployment] = useState<InitialDeployment | undefined>(initialDeployment);
  const [status, setStatus] = useState(
    startEditing && creating
      ? "未保存の新規記事です。本文を書いてGitHubへ保存してください。"
      : "",
  );
  const [draftStatus, setDraftStatus] = useState(
    initialDraftStored
      ? ""
      : "端末下書きを保存できません。本文を別の場所にも退避してください。",
  );
  const [error, setError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const changed = creating || content !== post.content;

  useEffect(() => {
    if (!editing) return;
    setDraftStatus("端末下書きを保存しています…");
    const timer = window.setTimeout(() => {
      const stored = writeDraft({
        version: 1,
        name: post.name,
        content,
        baseSha: creating ? null : baseSha,
        isNew: creating,
        savedAt: new Date().toISOString(),
      });
      setDraftStatus(
        stored
          ? "下書きをこの端末に保存しました。共有端末では保存後に破棄してください。"
          : "端末下書きを保存できません。本文を別の場所にも退避してください。",
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [baseSha, content, creating, editing, post.name]);

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
    setBaseSha(post.sha);
    setStatus("編集中です。保存するとGitHubのmainブランチへ反映されます。");
    setEditing(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const discardPendingDraft = () => {
    if (!pendingDraft) return;
    removeDraft(pendingDraft.name);
    setPendingDraft(undefined);
    setDraftStatus("");
    if (pendingDraft.isNew) onDiscardNew?.();
    else setStatus("端末の下書きを破棄しました。GitHub版を表示しています。");
  };

  const restorePendingDraft = () => {
    if (!pendingDraft) return;
    setContent(pendingDraft.content);
    setBaseSha(pendingDraft.baseSha ?? "");
    setCreating(pendingDraft.isNew);
    setPendingDraft(undefined);
    setEditing(true);
    setError(false);
    setDraftStatus("端末の下書きを復元しました。");
    setStatus(
      pendingDraft.isNew
        ? "未保存の新規記事です。本文を確認してGitHubへ保存してください。"
        : "端末の下書きを編集中です。",
    );
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const cancelEditing = () => {
    if (changed && !window.confirm("変更と、この端末に保存した下書きを破棄しますか？")) return;
    removeDraft(post.name);
    setDraftStatus("");
    if (creating) {
      onDiscardNew?.();
      return;
    }
    setContent(post.content);
    setBaseSha(post.sha);
    setEditing(false);
    setError(false);
    setStatus(changed ? "変更を破棄しました。" : "");
  };

  const save = async () => {
    setSaving(true);
    setError(false);
    setStatus("GitHubへ保存しています…");
    try {
      if (creating) {
        const created = await createPost(post.name, content);
        removeDraft(post.name);
        setDraftStatus("");
        setPost({
          ...post,
          content,
          sha: created.sha,
          githubUrl: created.githubUrl,
          publicUrl: created.publicUrl,
        });
        setBaseSha(created.sha);
        setCreating(false);
        setEditing(false);
        setStatus("新規記事をGitHubへ保存しました。公開処理はGitHub Actionsで進みます。");
        const nextDeployment: InitialDeployment = {
          commitSha: created.commitSha,
          purpose: "publish",
        };
        setDeployment(nextDeployment);
        onCreated?.(created.name, nextDeployment);
      } else {
        const update = await updatePost(post.name, content, baseSha);
        removeDraft(post.name);
        setDraftStatus("");
        setPost({ ...post, content, sha: update.sha, githubUrl: update.githubUrl });
        setBaseSha(update.sha);
        setEditing(false);
        setStatus("GitHubへ保存しました。公開処理はGitHub Actionsで進みます。");
        setDeployment({ commitSha: update.commitSha, purpose: "publish" });
      }
    } catch (cause) {
      setError(true);
      setStatus(cause instanceof Error ? cause.message : "記事を保存できませんでした。");
    } finally {
      setSaving(false);
    }
  };

  const renameIsValid =
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(renameSlug) &&
    renameSlug !== "index" &&
    `${renameSlug}.md` !== post.name &&
    renameConfirmation === post.name;

  const submitRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!renameIsValid || !post.sha) return;
    setOperationBusy(true);
    setError(false);
    setStatus("GitHubでslugを変更しています…");
    try {
      const renamed = await renamePost(
        post.name,
        `${renameSlug}.md`,
        post.content,
        post.sha,
        renameConfirmation,
      );
      removeDraft(post.name);
      const nextDeployment: InitialDeployment = {
        commitSha: renamed.commitSha,
        purpose: "publish",
      };
      setPost({
        ...post,
        name: renamed.name,
        path: `Content/posts/${renamed.name}`,
        sha: renamed.sha,
        githubUrl: renamed.githubUrl,
        publicUrl: renamed.publicUrl,
      });
      setBaseSha(renamed.sha);
      setRenameConfirmation("");
      setOperation(undefined);
      setDeployment(nextDeployment);
      setStatus("slugを変更しました。旧公開URLはredirectされません。");
      onRenamed?.(renamed.name, nextDeployment);
    } catch (cause) {
      setError(true);
      setStatus(cause instanceof Error ? cause.message : "slugを変更できませんでした。");
    } finally {
      setOperationBusy(false);
    }
  };

  const submitDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (deleteConfirmation !== post.name || !post.sha) return;
    setOperationBusy(true);
    setError(false);
    setStatus("GitHubから記事を削除しています…");
    try {
      const deletion = await deletePost(post.name, post.sha, deleteConfirmation);
      removeDraft(post.name);
      setPendingDraft(undefined);
      setDraftStatus("");
      setDeleted(true);
      setOperation(undefined);
      setDeployment({ commitSha: deletion.commitSha, purpose: "delete" });
      setStatus("GitHubから記事を削除しました。公開サイトへの反映を確認しています。");
    } catch (cause) {
      setError(true);
      setStatus(cause instanceof Error ? cause.message : "記事を削除できませんでした。");
    } finally {
      setOperationBusy(false);
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

  const draftConflict = Boolean(
    pendingDraft && !pendingDraft.isNew && pendingDraft.baseSha !== post.sha,
  );

  return (
    <>
      {pendingDraft && (
        <aside className="draft-notice">
          <p>
            この端末に未保存の下書きがあります（
            {new Date(pendingDraft.savedAt).toLocaleString("ja-JP")}）。
            {draftConflict && " GitHub版が更新されているため、復元後の保存では競合確認が必要です。"}
          </p>
          <div>
            <button className="primary" type="button" onClick={restorePendingDraft}>
              下書きを復元
            </button>
            <button type="button" onClick={discardPendingDraft}>
              下書きを破棄
            </button>
          </div>
        </aside>
      )}

      {operation === "rename" && (
        <aside className="rename-panel">
          <p>
            slugを変更すると公開URLも変わります。旧URLからのredirectは作成されず、外部linkは切れます。
          </p>
          <form onSubmit={submitRename}>
            <label>
              新しいslug
              <input
                name="rename-slug"
                required
                maxLength={100}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={renameSlug}
                disabled={operationBusy}
                onChange={(event) => setRenameSlug(event.target.value)}
              />
            </label>
            <label>
              確認用filename
              <input
                name="rename-confirmation"
                required
                value={renameConfirmation}
                disabled={operationBusy}
                onChange={(event) => setRenameConfirmation(event.target.value)}
              />
              <span className="field-help"><code>{post.name}</code> と入力してください。</span>
            </label>
            <div>
              <button className="primary" type="submit" disabled={!renameIsValid || operationBusy}>
                {operationBusy ? "変更中…" : "slugを変更"}
              </button>
              <button type="button" disabled={operationBusy} onClick={() => setOperation(undefined)}>
                変更をやめる
              </button>
            </div>
          </form>
        </aside>
      )}

      {operation === "delete" && (
        <aside className="delete-panel">
          <p>削除するとGitHubから記事fileを削除し、次のdeployで公開サイトからも消えます。</p>
          <form onSubmit={submitDelete}>
            <label>
              削除確認
              <input
                name="delete-confirmation"
                required
                value={deleteConfirmation}
                disabled={operationBusy}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
              />
              <span className="field-help"><code>{post.name}</code> と入力してください。</span>
            </label>
            <div>
              <button
                className="danger"
                type="submit"
                disabled={deleteConfirmation !== post.name || operationBusy}
              >
                {operationBusy ? "削除中…" : "記事を削除"}
              </button>
              <button type="button" disabled={operationBusy} onClick={() => setOperation(undefined)}>
                削除をやめる
              </button>
            </div>
          </form>
        </aside>
      )}

      {status && (
        <p className={error ? "error-message" : "workspace-status"} role={error ? "alert" : "status"}>
          {status}
        </p>
      )}
      {draftStatus && <p className="draft-state" role="status">{draftStatus}</p>}

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
              {saving ? "保存中…" : creating ? "新規記事を保存" : "GitHubへ保存"}
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
        ) : !deleted ? (
          <>
            <button type="button" disabled={Boolean(pendingDraft) || Boolean(operation)} onClick={beginEditing}>
              編集
            </button>
            <button
              type="button"
              disabled={Boolean(pendingDraft) || Boolean(operation)}
              onClick={() => {
                setRenameSlug(post.name.slice(0, -3));
                setRenameConfirmation("");
                setOperation("rename");
              }}
            >
              slug変更
            </button>
            <button
              type="button"
              disabled={Boolean(pendingDraft) || Boolean(operation)}
              onClick={() => {
                setDeleteConfirmation("");
                setOperation("delete");
              }}
            >
              削除
            </button>
          </>
        ) : null}
        {!creating && (
          <nav className="detail-links" aria-label="記事リンク">
            <a href={post.publicUrl} target="_blank" rel="noreferrer">
              {deleted ? "旧公開ページを確認" : "公開ページを開く"}
            </a>
            {!deleted && (
              <a href={post.githubUrl} target="_blank" rel="noreferrer">
                GitHubで元ファイルを開く
              </a>
            )}
          </nav>
        )}
      </div>

      {deployment && (
        <DeploymentStatus commitSha={deployment.commitSha} purpose={deployment.purpose} />
      )}
    </>
  );
}
