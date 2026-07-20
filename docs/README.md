# docs

この directory は、blog / diary 統合と script-based publish workflow の設計・運用メモをまとめています。

## まず読むもの

- `status.md` — 現在の状態、完了済み作業、残タスク
- `cms-development-handoff.md` — CMSの構成、Wrangler、認証、Secret、開発・deploy・troubleshoot手順
- `deploy.md` — build / deploy 手順
- `script-based-publish-workflow.md` — Markmesh に依存しない記事作成・画像 upload・publish 方針
- `post-migration-check.md` — 公開後の確認結果と smoke check

## diary 統合

- `blog-integration-plan.md` — 全体計画と現在の phase
- `diary-migration-rules.md` — GitHub Issues から Publish 記事への変換ルール
- `diary-migration-sources.md` — diary 記事・画像 source の整理
- `diary-redirects.md` — 旧 diary URL redirect 方針
- `diary-ui-notes.md` — diary UI に寄せるための見た目メモ

## Blog CMS

- `cms-development-handoff.md` — 別session向けの開発引き継ぎ資料
- `../cms/README.md` — CMS機能別の短い運用説明

## publish workflow

- `script-based-publish-workflow.md` — repository script を正本にする方針
- `markmesh-deploy-image-flow.md` — deploy 前に local image を Gyazo URL へ置換する方針
- `new-post-workflow.md` — 新規記事作成手順
- `gyazo-auth.md` — Gyazo API の token / OAuth 認証メモ

## 見た目確認

- `agent-browser-visual-check.md` — agent-browser による見た目確認手順

## 今後の docs 運用

実装の学習しやすさを優先するため、今後は docs 更新だけの細かいコミットを増やしすぎません。

- 実装コミットは小さく保つ。
- docs は必要なタイミングでまとめて更新する。
- 方針が変わった場合だけ、該当 docs を更新する。
