# diary migration rules

`diary` の GitHub Issues 記事を、この `blog` repository の Swift Publish 記事へ移すための変換ルールです。

## Source

記事本文の source は GitHub Issues API を使います。

```text
GET https://api.github.com/repos/tanabe1478/diary/issues?state=all&per_page=100
```

GitHub API の issues endpoint には Pull Request も混ざるため、`pull_request` field を持つ item は移行対象から除外します。

## 現在確認できた記事数

2026-05-11 時点で、GitHub Issues API から確認できた通常 issue は 19 件です。

最新の例:

```text
#34 ブログを書くためのアプリを作った
#26 diary の改修
#17 GmailをGeminiにつなげる方法
#16 Next.js 製ブログのアップデート作業記録
```

## Markdown file の保存先

移行後の記事は Swift Publish の既存構造に合わせて保存します。

```text
Content/posts/diary-{issueNumber}.md
```

例:

```text
Content/posts/diary-34.md
```

## Markdown format

Publish が記事 title を認識しやすいように、本文先頭に H1 を追加します。

```markdown
---
date: 2026-04-24 04:09
description: ""
tags: diary
---

# ブログを書くためのアプリを作った

本文...
```

既存 theme では article header 側にも title を表示するため、本文先頭の H1 は記事詳細ページでは CSS で隠します。記事一覧や metadata 生成のために H1 は残します。

## date

`created_at` を Publish frontmatter の `date` に変換します。

GitHub API:

```text
2026-04-24T04:09:20Z
```

Publish frontmatter:

```text
2026-04-24 04:09
```

timezone はまず UTC のまま変換します。日本時間に変換するかは、移行 script 実装前に必要なら見直します。

## tags

当面は全 diary 移行記事に `diary` tag を付けます。

```yaml
tags: diary
```

GitHub labels がある場合は、後で追加 tag として取り込めるようにします。ただし、現在確認した主要記事には label が付いていません。

## description

当面は空文字にします。

```yaml
description: ""
```

記事一覧は diary UI と同じく description を表示しないため、移行初期では description を生成しません。

## comments

現在確認できた通常 issue には comments がありません。

将来 comments がある issue を移行する場合は、次のどちらかを選びます。

1. 本文末尾に `## Comments` として追記する。
2. コメントは移行しない。

初期実装では comments は移行対象外にします。

## 画像 URL

既存 diary 記事の画像は、次のような URL で本文に含まれています。

```markdown
![alt](https://tanabe1478.github.io/diary/uploads/YYYY-MM-DD/file.png)
```

初期移行では、この URL をそのまま残します。

理由:

- 記事移行と画像移行を分けて、小さく安全に進めるため。
- 今後の新規画像は Gyazo にするが、既存画像の Gyazo 移行は別作業にした方が diff を追いやすいため。

## URL 方針

移行後の記事本体は Swift Publish 標準の path になります。

```text
/posts/diary-34/
```

既存 diary URL は別途 redirect を検討します。

```text
/diary/articles/34 -> /posts/diary-34/
```

redirect 実装は記事移行 script とは分けて進めます。

## 移行 script の責務

移行 script は次だけを行います。

1. GitHub Issues API から通常 issue を取得する。
2. PR を除外する。
3. issue number 降順または created_at 降順で処理する。
4. `Content/posts/diary-{number}.md` を生成する。
5. 既存 file がある場合は上書きしない。

上書き、削除、redirect 生成、画像再アップロードは別 command として扱います。
