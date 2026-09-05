# blog

https://tanabe1478.github.io の source repository です。

[moonbit-ssg](https://github.com/tanabe1478/moonbit-ssg)で静的siteを生成しています。旧`diary` repositoryのGitHub Issues記事は`Content/posts/diary-*.md`として取り込み済みです。

## 開発

固定revisionのMoonBit SSGでsiteを生成します。

```bash
git clone https://github.com/tanabe1478/moonbit-ssg ../moonbit-ssg
git -C ../moonbit-ssg checkout "$(cat .moonbit-ssg-revision)"
scripts/build_site.sh
```

生成結果は`Output/`に出力されます。別のcheckoutを使う場合は`MOONBIT_SSG_DIR`で指定できます。

```bash
MOONBIT_SSG_DIR=/path/to/moonbit-ssg scripts/build_site.sh
```

SSG自体を開発中で固定revisionの検査だけを明示的に外す場合は、`MOONBIT_SSG_ALLOW_UNPINNED=true`を指定します。

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

記事・画像・build・deploy をまとめて同期する場合:

```bash
scripts/publish_blog.py
```

公開前に画像置換対象だけ確認する場合:

```bash
scripts/publish_blog.py --dry-run
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

GitHub Actionsの`Check` workflowでは、script testを実行し、commit SHAで固定したMoonBit SSGで`Output/`を生成してlocal assetを検査します。

## deploy

通常は 1 コマンドで公開 site へ同期します。

```bash
scripts/publish_blog.py
```

このscriptはlocal imageのGyazo化、MoonBit buildとasset check、source repositoryのcommit / push、`Output/`のdeploy、公開後smoke checkまで実行します。

低レベルな deploy だけを実行したい場合は `scripts/deploy_site.sh --check` を使えます。

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
