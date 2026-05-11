# New post workflow

Markmesh extension ができるまでの暫定的な記事作成手順です。

## 記事作成

```bash
scripts/new_post.py "記事タイトル" --slug article-slug
```

生成先:

```text
Content/posts/article-slug.md
```

生成される Markdown:

```markdown
---
date: yyyy-MM-dd HH:mm
description: ""
tags: 日記
---

# 記事タイトル
```

## option

```bash
scripts/new_post.py "記事タイトル" \
  --slug article-slug \
  --tag 日記 \
  --tag 技術 \
  --description "説明"
```

## 画像を Gyazo に upload する

Markmesh extension ができるまでは、暫定 script で Gyazo に upload できます。

Gyazo API は `Authorization: Bearer <token>` header と `imagedata` form field で upload します。

```bash
GYAZO_ACCESS_TOKEN=... scripts/upload_image_to_gyazo.py path/to/image.png
```

または、commit されない `.env` に token を置いて実行できます。

```bash
cp .env.example .env
# .env の GYAZO_ACCESS_TOKEN を設定
scripts/upload_image_to_gyazo.py path/to/image.png
```

出力例:

```markdown
[![image](https://i.gyazo.com/example.png)](https://gyazo.com/example)
```

直接画像だけを挿入したい場合:

```bash
GYAZO_ACCESS_TOKEN=... scripts/upload_image_to_gyazo.py path/to/image.png --direct
```

## 確認

```bash
swift run
python3 -m http.server 4173 --directory Output
```

## 将来の方針

この script は Markmesh extension の `Blog: New Post` command の下書きです。

最終的には、Markmesh 上で title、slug、tags、description を入力し、同じ形式の Markdown を生成します。
