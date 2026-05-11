# blog

https://tanabe1478.github.io の source repository です。

Swift Publish で静的 site を生成しています。旧 `diary` repository の GitHub Issues 記事は `Content/posts/diary-*.md` として取り込み済みです。

## 開発

site を生成します。

```bash
swift run
```

生成結果は `Output/` に出力されます。

新しい記事の雛形を作る場合:

```bash
scripts/new_post.py "記事タイトル" --slug article-slug
```

画像を Gyazo に upload して Markdown を得る場合:

```bash
GYAZO_ACCESS_TOKEN=... scripts/upload_image_to_gyazo.py path/to/image.png
```

Gyazo OAuth の認可 URL を作る場合:

```bash
scripts/gyazo_authorize_url.py
```

OAuth callback を local で受ける場合:

```bash
scripts/gyazo_oauth_callback_server.py --state STATE_FROM_AUTHORIZE_URL
```

OAuth callback の code を access token に交換する場合:

```bash
scripts/exchange_gyazo_oauth_code.py CODE_FROM_CALLBACK
```

local で確認する場合:

```bash
python3 -m http.server 4173 --directory Output
```

ブラウザで開く URL:

```text
http://127.0.0.1:4173/
```

## deploy

公開 site へ deploy します。

```bash
scripts/deploy_site.sh
```

公開後の smoke check まで実行する場合:

```bash
scripts/deploy_site.sh --check
```

`swift run` のあと、`Output/` を `tanabe1478/tanabe1478.github.io` repository へ directory 構造を保ったまま反映します。

詳しくは `docs/deploy.md` を参照してください。

公開後の簡易確認:

```bash
scripts/check_public_site.py
```

## diary 統合

旧 diary URL は diary repository 側で redirect します。

```text
/diary/             -> /
/diary/articles/34  -> /posts/diary-34/
```

関連 docs:

- `docs/status.md`
- `docs/blog-integration-plan.md`
- `docs/diary-migration-rules.md`
- `docs/diary-migration-sources.md`
- `docs/diary-redirects.md`
- `docs/post-migration-check.md`

## CMS 方針

独立した Desktop Writer は作らず、今後の CMS は Markmesh extension として実装します。

画像の新規 upload は Gyazo を前提にします。

将来の extension 用設定は以下に置いています。

```text
.markmesh/extensions/tanabe-blog.yml
```

詳しくは以下を参照してください。

- `docs/markmesh-extension-cms.md`
- `docs/markmesh-extension-api-proposal.md`
