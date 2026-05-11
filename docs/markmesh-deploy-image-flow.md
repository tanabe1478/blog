# Markmesh deploy image flow

Markmesh blog CMS extension では、deploy 時に画像を直接 upload するのではなく、deploy 前の準備 step で local image を Gyazo URL に置換します。

## 方針

```text
Blog: Prepare for Deploy
  1. 記事内 local image を検出
  2. 未 upload 画像だけ Gyazo へ upload
  3. Markdown の画像 URL を Gyazo URL に置換
  4. swift run
  5. public smoke check 相当の確認
  6. git diff を user に見せる

Blog: Deploy
  1. Prepare for Deploy
  2. git commit
  3. git push
  4. scripts/deploy_site.sh --check
```

## なぜ deploy と upload を分けるか

Gyazo upload は外部サービスへの副作用です。

- 外部 URL が作られる。
- Markdown が書き換わる。
- token / network error の影響を受ける。
- 同じ画像を何度も upload する事故を避けたい。

そのため、`Deploy` の中で暗黙に upload するのではなく、`Prepare for Deploy` として明示します。

## upload 対象

最初は extension が管理する local path だけを対象にします。

例:

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

## 暫定 script

Markmesh extension 実装前の検証用に、同じ考え方の暫定 script を用意しています。

```bash
scripts/replace_local_images_with_gyazo.py Content/posts/example.md
```

対象確認だけ行う場合:

```bash
scripts/replace_local_images_with_gyazo.py --dry-run Content/posts/example.md
```

`Prepare for Deploy` 相当の暫定 script:

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

`linked-image` を初期値にします。direct image が必要な場合は extension config で切り替えます。

## 重複 upload 防止

初期実装では、Markdown を Gyazo URL に置換することで次回以降の upload 対象から外します。

必要になったら manifest を追加します。

```yaml
# .markmesh/extensions/tanabe-blog-images.yml
uploads:
  attachments/desk.png:
    sha256: ...
    url: https://i.gyazo.com/example.png
    permalinkUrl: https://gyazo.com/example
```

ただし、最初から manifest を必須にすると重くなるため、初期実装では採用しません。
