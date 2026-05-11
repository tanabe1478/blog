# docs

この directory は、blog / diary 統合と今後の Markmesh extension CMS のための設計・運用メモをまとめています。

## まず読むもの

- `status.md` — 現在の状態、完了済み作業、残タスク
- `deploy.md` — build / deploy 手順
- `post-migration-check.md` — 公開後の確認結果と smoke check

## diary 統合

- `blog-integration-plan.md` — 全体計画と現在の phase
- `diary-migration-rules.md` — GitHub Issues から Publish 記事への変換ルール
- `diary-migration-sources.md` — diary 記事・画像 source の整理
- `diary-redirects.md` — 旧 diary URL redirect 方針
- `diary-ui-notes.md` — diary UI に寄せるための見た目メモ

## Markmesh extension CMS

- `markmesh-extension-cms.md` — CMS を Markmesh extension として作る方針
- `markmesh-extension-api-proposal.md` — Markmesh 本体に必要な汎用 extension API の要求仕様
- `new-post-workflow.md` — extension 完成までの暫定新規記事作成手順
- `gyazo-auth.md` — Gyazo API の token / OAuth 認証メモ

## 見た目確認

- `agent-browser-visual-check.md` — agent-browser による見た目確認手順

## 今後の docs 運用

実装の学習しやすさを優先するため、今後は docs 更新だけの細かいコミットを増やしすぎません。

- 実装コミットは小さく保つ。
- docs は必要なタイミングでまとめて更新する。
- 方針が変わった場合だけ、該当 docs を更新する。
