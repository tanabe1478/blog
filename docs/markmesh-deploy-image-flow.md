# Deploy image flow

Deploy 前に local image を Gyazo URL に置換します。

この処理は editor / Markmesh に依存させず、repository の script として実行します。

## 方針

```text
scripts/prepare_for_deploy.py
  1. 記事内 local image を検出
  2. 未 upload 画像を Gyazo へ upload
  3. Markdown の画像 URL を Gyazo URL に置換
  4. swift run
  5. scripts/check_output_site.py

scripts/deploy_site.sh
  1. prepare_for_deploy.py
  2. Output/ 全体を deploy repository へ rsync
  3. git commit / push
  4. optional: scripts/check_public_site.py
```

## なぜ deploy 前にまとめて upload するか

Gyazo upload は外部サービスへの副作用です。

- 外部 URL が作られる。
- Markdown が書き換わる。
- token / network error の影響を受ける。
- 同じ画像を何度も upload する事故を避けたい。

そのため、個別 editor 操作ではなく、deploy 前の明示的な準備 step として実行します。

## upload 対象

最初は明示的な local path だけを対象にします。

```markdown
![desk](attachments/desk.png)
![desk](.markmesh/blog-assets/desk.png)
```

対象外:

```markdown
![already gyazo](https://i.gyazo.com/example.png)
![github image](https://user-images.githubusercontent.com/example.png)
![blog asset](/images/example.png)
```

## script

画像置換だけ行う場合:

```bash
scripts/replace_local_images_with_gyazo.py Content/posts/example.md
```

対象確認だけ行う場合:

```bash
scripts/replace_local_images_with_gyazo.py --dry-run Content/posts/example.md
```

全記事の画像置換と build をまとめて行う場合:

```bash
scripts/prepare_for_deploy.py
```

画像置換の確認だけ:

```bash
scripts/prepare_for_deploy.py --dry-run --skip-build
```

初期対象 prefix:

```text
attachments/
.markmesh/blog-assets/
```

## Markdown 置換

local image:

```markdown
![desk](attachments/desk.png)
```

Gyazo upload 後:

```markdown
[![desk](https://i.gyazo.com/example.png)](https://gyazo.com/example)
```

## 重複 upload 防止

初期実装では、Markdown を Gyazo URL に置換することで次回以降の upload 対象から外します。

必要になったら manifest を追加します。

```yaml
uploads:
  attachments/desk.png:
    sha256: ...
    url: https://i.gyazo.com/example.png
    permalinkUrl: https://gyazo.com/example
```

ただし、最初から manifest を必須にすると重くなるため、初期実装では採用しません。
