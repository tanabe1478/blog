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

```bash
npm run check
```

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
