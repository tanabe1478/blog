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
