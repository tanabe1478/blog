import { useCallback, useEffect, useRef, useState } from "react";

import { fetchDeployment, type BlogDeployment } from "./api";

export type DeploymentPurpose = "publish" | "delete";

interface DeploymentStatusProps {
  commitSha: string;
  purpose: DeploymentPurpose;
}

function deploymentMessage(deployment: BlogDeployment, purpose: DeploymentPurpose): string {
  if (deployment.state === "pending") {
    return purpose === "delete"
      ? "GitHubから削除済み・公開サイトへの反映待ちです。"
      : "保存済み・build待ちです。";
  }
  if (deployment.state === "running") {
    return purpose === "delete"
      ? "公開サイトから記事を削除中です。"
      : "公開処理を実行中です。";
  }
  if (deployment.state === "published") {
    return purpose === "delete"
      ? "公開サイトからの削除が反映されました。"
      : "公開済みです。";
  }
  return purpose === "delete"
    ? "削除の公開反映に失敗しました。GitHub Actionsを確認してください。"
    : "公開処理に失敗しました。GitHub Actionsを確認してください。";
}

export function DeploymentStatus({ commitSha, purpose }: DeploymentStatusProps) {
  const [deployment, setDeployment] = useState<BlogDeployment>();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const checks = useRef(0);

  const refresh = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    checks.current += 1;
    try {
      setDeployment(await fetchDeployment(commitSha));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [commitSha, loading]);

  useEffect(() => {
    checks.current = 0;
    setDeployment(undefined);
    setLoadError(false);
    void refresh();
  }, [commitSha, purpose]); // refresh intentionally follows the commit, not loading state.

  useEffect(() => {
    if (
      !deployment ||
      (deployment.state !== "pending" && deployment.state !== "running") ||
      checks.current >= 30
    ) return;
    const timer = window.setTimeout(() => void refresh(), 10_000);
    return () => window.clearTimeout(timer);
  }, [deployment, refresh]);

  const label = loadError
    ? purpose === "delete"
      ? "記事はGitHubから削除済みですが、公開状況を取得できません。手動で再確認できます。"
      : "記事は保存済みですが、公開状況を取得できません。手動で再確認できます。"
    : deployment
      ? deploymentMessage(deployment, purpose)
      : purpose === "delete"
        ? "GitHubから削除済み。公開サイトへの反映を確認しています…"
        : "保存済み。公開処理を確認しています…";

  return (
    <aside
      className="deployment-status"
      data-state={loadError ? undefined : deployment?.state}
      aria-live="polite"
    >
      <p>{label}</p>
      <div className="deployment-actions">
        <button type="button" disabled={loading} onClick={() => {
          checks.current = 0;
          void refresh();
        }}>
          {loading ? "確認中…" : "公開状況を再確認"}
        </button>
        {deployment?.runUrl && (
          <a href={deployment.runUrl} target="_blank" rel="noreferrer">
            GitHub Actionsを開く
          </a>
        )}
      </div>
    </aside>
  );
}
