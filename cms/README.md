# Blog CMS

このdirectoryには、ブログ専用Cloudflare Workerを置きます。記事の正本は引き続きrepositoryの`Content/posts/*.md`です。

公開先:

```text
https://tanabe-blog-cms-api.enterprise2580.workers.dev
```

health check:

```text
GET https://tanabe-blog-cms-api.enterprise2580.workers.dev/api/health
```

## yuruboとの分離

- Worker名は`tanabe-blog-cms-api`に固定する。
- yuruboのCloudflare Account、API token、binding、secretを使用しない。
- `wrangler.jsonc`の`account_id`をブログCMS専用Accountに固定する。
- CIではブログCMS専用Accountにscopeを限定したAPI tokenを使用する。
- D1、KV、R2が必要になった場合もブログCMS専用resourceを新規作成する。

## authentication

Productionの`workers.dev` URLはCloudflare Accessで保護します。Access Policyに加えて、Workerも`Cf-Access-Jwt-Assertion`の署名、issuer、audienceを検証します。

`TEAM_DOMAIN`と`POLICY_AUD`は認証情報ではないため`wrangler.jsonc`で管理します。ProductionとPreviewでAudienceが異なる場合、`POLICY_AUD`へカンマ区切りで指定します。

認証を迂回する`ACCESS_BYPASS=true`は`npm run dev`からlocal Wranglerへだけ渡します。本番の`wrangler.jsonc`には設定しません。

## Post list

記事一覧はGitHub GraphQL APIから`Content/posts/*.md`のfrontmatterと最初のheadingを取得します。Section用の`index.md`は除外し、公開blogのtop pageと同じdate降順でtitle・date・filenameを表示します。

## Local draft

編集中のMarkdownは400msのdebounce後にbrowserの`localStorage`へ自動保存します。既存記事・新規記事ともreload後に**下書きを復元**または**下書きを破棄**を選べます。GitHub保存成功時と、確認後のcancel時に対応draftを削除します。

下書きには保存時のGitHub SHAを記録します。GitHub版がその後更新された場合、復元後も古いSHAを使って保存するため`409`となり、最新記事を無意識に上書きしません。

`localStorage`は暗号化されたsecret storageではなく、Accessからlogoutしても端末に本文が残ります。共有端末では下書きを破棄してください。token、JWT、cookieは保存しません。storageが利用できない場合もeditorは止めず、別の場所への退避を案内します。

## New article

記事一覧の**新規記事**からslug、title、公開日時、description、tagsを入力すると、frontmatterと見出しを持つ未保存Markdownをbrowser内で生成します。本文を書いて**GitHubへ保存**した時点で初めて`Content/posts/<slug>.md`を作成するため、空の雛形だけが公開されることはありません。

slugは英小文字・数字・単一hyphenだけを許可し、Section予約名`index`は拒否します。同名fileがGitHubにある場合は上書きせず`409`を返します。作成も既存記事の更新と同じくProduction Originだけで許可します。

## Article detail and live preview

記事detailの閲覧時はMarkdown sourceではなく描画済みpreviewを表示します。各記事detailにはGitHub sourceと公開ページへのlinkを表示します。編集状態にすると、左にMarkdown textarea、右にリアルタイムpreviewを表示します。800px以下では縦1列へ切り替わります。

previewはheading、paragraph、list、blockquote、code block、link、Gyazoを含むMarkdown画像に対応します。Markdown内のraw HTMLは実行せず文字として表示し、URL schemeとCSPの両方で外部contentを制限します。

## Slug rename

既存記事detailの**slug変更**から、新slugと現在filenameの完全入力で記事filenameと公開URLを変更できます。旧公開URLからのredirectは自動作成しないため、外部linkが切れることをpanel内で警告します。

WorkerはProduction Origin、現在Blob SHA、新path不存在、main HEADを確認します。GitHub GraphQL `createCommitOnBranch`で新path追加と旧path削除を1つのatomic commitにするため、部分成功しません。main更新・old SHA変更・new slug既存は`409`です。

成功後は新しいBlob SHA、GitHub URL、公開URLへdetailを切り替え、rename commitのDeploy Blog statusを追跡します。Previewからのrenameは`403`、`index`は新旧とも指定できません。

## Article deletion

既存記事detailの**削除**から、対象filenameを完全入力すると記事を削除できます。WorkerはProduction Origin、`GITHUB_TOKEN`、現在のBlob SHA、confirmation一致を再検証します。Section用`index.md`は削除できません。

GitHub Contents APIがSHA競合を返した場合は`409`として記事を残します。削除成功後は削除commitの`Deploy Blog`を追跡し、公開サイトからの削除反映を表示します。記事内で使っていたGyazo画像は自動削除しません。

端末draftがある間は、復元または破棄を選ぶまで削除buttonを無効化します。Preview hostnameからの削除は`403`です。

## Publish status

記事のGitHub保存後、source commit SHAを使って`Deploy Blog` workflowを追跡します。CMSには**保存済み・build待ち**、**公開処理を実行中**、**公開済み**、**公開処理に失敗**を表示します。

10秒間隔、最大約5分で自動確認し、完了・失敗時に停止します。手動の**公開状況を再確認**とGitHub Actionsへのlinkも利用できます。workflowはpublic smoke checkまで含むため、成功を公開済みとして扱います。

status取得に失敗してもGitHubへの記事保存は取り消しません。最初は既存`GITHUB_TOKEN`を使い、Actions read権限がなく`401/403`の場合だけpublic repository APIへ認証なしでfallbackします。新しいSecretやtoken scopeは追加しません。

## GitHub article editing

既存記事の保存には、`tanabe1478/blog`だけに`Contents: Read and write`を持つfine-grained tokenを使います。tokenはCloudflare Worker Secret `GITHUB_TOKEN`として保存し、repositoryやブラウザへ渡しません。

```bash
npx wrangler secret put GITHUB_TOKEN
```

保存APIは`wrangler.jsonc`の`WRITE_HOST`と一致するProduction hostnameからだけ受け付けます。Preview URLは記事を閲覧できますが、GitHubへの書き込みは`403`で拒否します。

CMSの保存は`Content/posts/*.md`をGitHubの`main`へcommitします。この時点では既存の`publish_blog.py`によるGitHub Pages公開処理までは実行しません。

## Gyazo image upload

画像はWorkerからGyazoへ直接uploadします。access tokenはCloudflare Worker Secret `GYAZO_ACCESS_TOKEN`として保存し、repositoryやブラウザへ渡しません。

```bash
npx wrangler secret put GYAZO_ACCESS_TOKEN
```

Production CMSからの同一Origin requestだけを受け付け、Previewからのuploadは`403`で拒否します。PNG・JPEG・GIF・WebPのfile signatureを検証し、sizeは10MB以下に制限します。

記事を編集状態にすると、file pickerに加えてMarkdown textareaへのdrag-and-dropで画像を1枚ずつuploadできます。挿入先は現在のcursor位置です。

Gyazo uploadは即時に外部へ画像を作成する副作用があります。textareaへ挿入した後にキャンセルしてもGyazo画像は自動削除されません。記事へ反映するには、続けて**GitHubへ保存**を実行します。

## local development

```bash
cd cms
npm install
npm run dev
```

動作確認:

```text
GET http://localhost:8787/api/health
```

## checks

初回だけPlaywright Chromiumをinstallします。

```bash
npx playwright install chromium
```

全check:

```bash
npm run check
```

これはTypeScript、Vitest、Playwright E2Eを順に実行します。E2Eはlocal Wranglerを起動し、browserからのAPI requestをmockするため、実GitHubやGyazoへwriteしません。

## deploy

localでは`wrangler login`で認証したユーザーを使用します。デプロイ先は`wrangler.jsonc`のブログCMS専用Account IDに固定されています。

```bash
npm run deploy
```

CIではブログCMS専用Accountにscopeを限定した`CLOUDFLARE_API_TOKEN`をsecretとして設定します。tokenをrepository内のファイルへ保存しないでください。

## GitHub Actions deploy

`main`へ`cms/**`の変更がpushされると、`.github/workflows/deploy-cms.yml`がcheck後にWorkerをdeployします。GitHub Actionsの手動実行にも対応しています。

Cloudflare Dashboardの**Account API tokens**でtokenを作成します。

1. **Create Token**を選ぶ。
2. **Edit Cloudflare Workers** templateを選ぶ。
3. Account resourceをブログCMS専用Accountだけに限定する。
4. GitHub repositoryの**Settings → Secrets and variables → Actions**を開く。
5. Repository secret `CLOUDFLARE_API_TOKEN`として保存する。

Secretの値は画面、terminal、chat、repositoryへ貼り付けず、CloudflareからGitHubのSecret入力欄へ直接コピーします。
