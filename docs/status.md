# Current status

2026-05-11 時点の統合作業ステータスです。

## 完了

### blog / diary 統合

- diary の GitHub Issues 記事 19 件を `Content/posts/diary-*.md` に取り込み済み。
- 移行 script `scripts/migrate_diary_issues.py` を追加済み。
- blog 全体を diary 風のミニマル UI に寄せ済み。
- 旧 diary project site は redirect site に変更済み。
- 旧 diary upload 画像のうち、blog 側で必要な画像は `Resources/images/uploads/` に保全済み。

### deploy

- `scripts/deploy_site.sh` で `Output/` を directory 構造を保ったまま `tanabe1478/tanabe1478.github.io` に deploy する運用に変更済み。
- Publish built-in deploy は path flatten 問題があったため使わない。
- 公開後確認用の `scripts/check_public_site.py` を追加済み。

### docs

- `AGENTS.md` に小さなコミット単位と丁寧なコミットメッセージ方針を追加済み。
- `docs/` に統合計画、migration rules、redirect、deploy、post migration check を整理済み。
- Markmesh extension API の要求仕様を `docs/markmesh-extension-api-proposal.md` に整理済み。

## 現在の公開 URL

```text
https://tanabe1478.github.io/
https://tanabe1478.github.io/posts/diary-34/
https://tanabe1478.github.io/diary/
https://tanabe1478.github.io/diary/articles/34
```

`/diary/` と `/diary/articles/{number}` は diary repository 側の redirect page です。

## 確認コマンド

local build:

```bash
swift run
```

local preview:

```bash
python3 -m http.server 4173 --directory Output
```

public smoke check:

```bash
scripts/check_public_site.py
```

deploy:

```bash
scripts/deploy_site.sh
```

## 残タスク

### Markmesh extension CMS

- Markmesh 本体の extension API 設計を進める。
- commands API、workspace file API、editor insertion API、secret storage API、network permission、task runner、git API を検討する。
- blog CMS extension skeleton を作る。
- Gyazo token の保存方法を決める。
- `Blog: New Post` と `Blog: Upload Image to Gyazo` を実装する。

### 見た目確認

- agent-browser で公開 blog のトップ、移行記事、既存記事を確認する。
- diary 風 UI として違和感があれば、小さな CSS commit で調整する。

### diary repository cleanup

- diary repository の旧 sync / publish workflow を今後どう扱うか決める。
- redirect site として最低限必要な構成にさらに削るか検討する。

### 画像

- 既存記事に残っている `user-images.githubusercontent.com` などの外部画像をそのまま許容するか、将来 Gyazo / blog asset に寄せるか決める。
- 新規画像は Gyazo 前提。

## 判断済みの方針

- Desktop Writer / standalone Mac app は作らない。
- CMS は Markmesh extension として作る。
- blog 固有機能は Markmesh 本体に入れない。
- Markmesh 本体には汎用 extension API だけを追加する。
- 見た目確認は agent-browser を主に使う。
- 自動 screenshot test は必要になった段階で小さく再導入する。
