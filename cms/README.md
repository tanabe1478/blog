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
