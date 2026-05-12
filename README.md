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

記事内の local image を Gyazo URL に置換する場合:

```bash
scripts/replace_local_images_with_gyazo.py Content/posts/example.md
```

deploy 前の準備をまとめて行う場合:

```bash
scripts/prepare_for_deploy.py
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

## CI

GitHub Actions の `Check` workflow で `swift run` を実行し、site が生成できることを確認します。

## deploy

公開 site へ deploy します。

```bash
scripts/deploy_site.sh
```

公開後の smoke check まで実行する場合:

```bash
scripts/deploy_site.sh --check
```

`scripts/prepare_for_deploy.py` で local image の Gyazo 化と `swift run` を実行したあと、`Output/` を `tanabe1478/tanabe1478.github.io` repository へ directory 構造を保ったまま反映します。

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

## publish workflow 方針

記事作成、画像 upload、build、deploy は Markmesh に依存させず、repository 内の script を正本にします。

画像の新規 upload は Gyazo を前提にします。

詳しくは以下を参照してください。

- `docs/script-based-publish-workflow.md`
- `docs/markmesh-deploy-image-flow.md`
