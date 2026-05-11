# diary redirects

`diary` の既存 URL から、`blog` に移行した記事へ辿れるように、diary repository 側を redirect site にしています。

## 対象

既存 diary URL:

```text
https://tanabe1478.github.io/diary/
https://tanabe1478.github.io/diary/articles/{issueNumber}
```

移行後 blog URL:

```text
/
/posts/diary-{issueNumber}
```

例:

```text
/diary/articles/34 -> /posts/diary-34
```

## 実装

`/diary/` は `tanabe1478/diary` の GitHub Pages project site として配信されています。

そのため、redirect はこの `blog` repository ではなく、`tanabe1478/diary` repository 側で実装します。

現在の diary repository は、記事一覧・記事詳細を表示せず、次を含む静的 redirect page を生成します。

- `meta refresh`
- `canonical` link
- fallback 用の通常 link

## 注意

これは GitHub Pages 上で使える静的 HTML redirect です。HTTP status code 301/302 の redirect ではありません。

GitHub Pages で server-side redirect は使えないため、静的 site として扱いやすい meta refresh を採用しています。

`blog` repository 側で `Output/diary/...` を生成しても、project site が有効な間は diary repository 側の `/diary/` が優先されます。そのため、blog 側には diary redirect 生成 step を置きません。
