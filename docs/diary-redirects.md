# diary redirects

`diary` の既存 URL から、`blog` に移行した記事へ辿れるように redirect page を生成します。

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

`Sources/Blog/Utilities/DiaryRedirects.swift` に Publish の custom step を定義しています。

```swift
.generateDiaryRedirects()
```

この step は `generateHTML` の後に実行され、`Output/diary/.../index.html` を生成します。

redirect page には次を含めます。

- `meta refresh`
- `canonical` link
- fallback 用の通常 link

## 注意

これは GitHub Pages 上で使える静的 HTML redirect です。HTTP status code 301/302 の redirect ではありません。

GitHub Pages で server-side redirect は使えないため、まずは静的 site として扱いやすい meta refresh を採用しています。
