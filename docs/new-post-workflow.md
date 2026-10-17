# New post workflow

repository scriptまたはBlog CMSを使った記事作成手順です。

## Blog CMSから作成

1. Blog CMSの記事一覧で**新規記事**を選ぶ。
2. slug、title、公開日時、description、tagsを入力する。
3. **本文を編集**で未保存Markdownとpreviewを開く。
4. 本文と画像を編集する。
5. **GitHubへ保存**で`Content/posts/<slug>.md`を初めて作成する。
6. GitHub Actionsによるbuild/deploy後、記事detailの**公開ページを開く**から確認する。

フォームを開いただけ、または未保存editorをキャンセルした場合はGitHubにfileを作りません。slugは英小文字・数字・hyphenを使い、既存記事と`index`は指定できません。

## Repository scriptから作成

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

## 画像を追加する

画像は repository の `Resources/images/` に置き、GitHub Pages から配信します。外部サービスや token は不要です。

執筆中は記事の近くに置いた画像を参照します。

```markdown
![desk](attachments/desk.png)
```

公開時に `scripts/publish_blog.py` が `Resources/images/<slug>/<hash>.png` へ取り込み、参照を `/images/<slug>/<hash>.png` に書き換えます。先に取り込みだけ行う場合:

```bash
scripts/import_local_images.py Content/posts/article-slug.md
```

詳しくは `docs/image-hosting.md` を参照してください。

## 公開

記事を書き終えたら、次の 1 コマンドで画像の取り込み、build、source repository の commit / push、deploy、公開後確認まで行います。

```bash
scripts/publish_blog.py
```

画像置換対象だけ確認する場合:

```bash
scripts/publish_blog.py --dry-run
```

## 方針

記事作成workflowはrepository scriptとBlog CMSのどちらも`Content/posts/*.md`を正本とし、Markmeshに依存させません。

Markmesh や別の editor を使う場合も、記事の作成・画像 upload・build・deploy はこの repository の script を正本にします。
