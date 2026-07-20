# Current status

blog / diary統合の基準日は2026-05-11です。Blog CMSの最新状況は`cms-development-handoff.md`も参照してください。

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

### Blog CMS

- ブログ専用Cloudflare Worker `tanabe-blog-cms-api`を追加済み。
- Production/PreviewをCloudflare Accessで保護し、Worker内でもJWTを検証済み。
- GitHub上の記事一覧・描画済みdetail・新規作成・SHA競合検知付き保存に対応済み。
- 記事detailからGitHub sourceと公開ページを開ける。
- 記事一覧は公開blogと同じ43記事をdate降順で表示する。
- Gyazo画像のfile picker / drag-and-drop uploadに対応済み。
- 編集時の2ペインlive Markdown previewに対応済み。
- CMS保存後はGitHub ActionsがSwift Publish buildとGitHub Pages deployを自動実行する。
- Playwright E2EをlocalとCIへ導入し、今後のuser-facing機能の完了条件に設定済み。
- localStorage自動下書き、reload復元、保存後削除、SHA変更時の競合維持に対応済み。
- 保存commitを基準にbuild待ち・実行中・公開済み・失敗statusをCMSへ表示済み。
- filename確認・SHA競合検知・Production限定の記事削除に対応済み。
- Cloudflare resourceとtokenは`yurubo`から分離済み。

### docs

- `AGENTS.md` に小さなコミット単位と丁寧なコミットメッセージ方針を追加済み。
- `docs/cms-development-handoff.md`にWrangler、認証、Secret、開発、deploy、troubleshoot手順を整理済み。
- `docs/` に統合計画、migration rules、redirect、deploy、post migration check を整理済み。
- publish workflow 方針を `docs/script-based-publish-workflow.md` に整理済み。

### script-based publish workflow

- blog の記事作成、画像 upload、build、deploy は Markmesh に依存させず、repository 内 script を正本にする方針へ変更済み。
- `scripts/publish_blog.py` で `Content/posts/*.md` 全体の local image 置換、`swift run`、source repository の commit / push、deploy、公開後 smoke check をまとめて実行できる。
- 下位 script として `scripts/prepare_for_deploy.py` と `scripts/deploy_site.sh` も残している。
- blog 側の Markmesh plugin / extension 設定は撤退済み。

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

CMSの正式な優先順、完了条件、E2E方針は`cms-roadmap.md`を正本とします。最初にPlaywright E2E基盤を追加し、その後はtaskごとに関連E2Eを追加して進めます。

> 2026-05-12: Markmesh extension CMS 方針は撤回。blog workflow はscript-basedを正本とし、現在のWeb CMSもこのrepositoryを直接更新する。

### Blog CMS

- 明示確認と競合検知付きのslug変更（rename）。
- 保存後のGitHub Actions / GitHub Pages deploy status表示。
- 一覧のsearch/filter。
- fine-grained tokenの期限・rotation手順の定期確認。

### script workflow

- `scripts/publish_blog.py --dry-run` で全記事の local image 対象確認を行う。
- `scripts/publish_blog.py` で画像置換、build、source commit / push、deploy、公開後 smoke check まで行う。
- Markmesh は Markdown editor / previewer の一候補として扱い、publish workflow の必須依存にはしない。

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
- blog workflow は Markmesh に依存させず、repository script を正本にする。
- Markmesh は Markdown editor / previewer の一候補として扱う。
- 画像の新規 upload は Gyazo 前提。
- 見た目確認は agent-browser を主に使う。
- 自動 screenshot test は必要になった段階で小さく再導入する。
