# Deploy image flow

Deploy 前に local image を `Resources/images/` へ取り込み、Markdown の参照を `/images/...` に置換します。画像の置き場所の方針は `docs/image-hosting.md` を正本とします。

この処理は editor / Markmesh に依存させず、repository の script として実行します。

## 方針

```text
scripts/prepare_for_deploy.py
  1. 記事内 local image を検出
  2. Resources/images/<slug>/<sha256先頭16桁>.<ext> へ copy
  3. Markdown の画像 URL を /images/<slug>/... に置換
  4. scripts/build_site.shでMoonBit siteを生成
  5. scripts/check_output_site.py

scripts/deploy_site.sh
  1. prepare_for_deploy.pyでMoonBitのOutput/を生成・検査
  2. Output/全体をdeploy repositoryへrsync
  3. git commit / push
  4. optional: scripts/check_public_site.py
```

## なぜ deploy 前にまとめて取り込むか

- Markdown が書き換わるため、執筆中ではなく明示的な準備 step で行いたい。
- 記事単位ではなく `Content/posts/` 全体の local image をまとめて処理したい。
- 取り込みは repository 内の copy だけなので、token や network error の影響を受けない。

## 対象

明示的な local path だけを対象にします。

```markdown
![desk](attachments/desk.png)
![desk](.markmesh/blog-assets/desk.png)
```

対象外:

```markdown
![github image](https://user-images.githubusercontent.com/example.png)
![blog asset](/images/example.png)
```

## script

1 記事だけ取り込む場合:

```bash
scripts/import_local_images.py Content/posts/example.md
```

対象確認だけ行う場合:

```bash
scripts/import_local_images.py --dry-run Content/posts/example.md
```

全記事の取り込みと build をまとめて行う場合:

```bash
scripts/prepare_for_deploy.py
```

取り込みの確認だけ:

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

取り込み後:

```markdown
![desk](/images/example/0123456789abcdef.png)
```

## 重複防止

filename を画像内容の sha256 から決めるため、同じ画像は何度取り込んでも同じ path になります。置換後の `/images/...` は対象外なので、次回以降は処理されません。manifest は不要です。

copy 元の `attachments/...` は削除しません。
