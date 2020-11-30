

---
date: 2020-11-29 21:40
description: このブログの構成について
tags: 技術,
---

# このブログがどうやって出来ているか

## 静的なファイルの生成 Publish

静的なファイルの生成にはSwift製の静的サイトジェネレータ [JohnSundell/Publish](https://github.com/JohnSundell/Publish)を使っている。

postsディレクトリ以下に決まったフォーマットで書いたmarkdownファイルを置いた後、`publish deploy`コマンドでGitHub Pagesにデプロイされる。XCodeでSchemeを新規作成してArguments Passed On Launchに`--deploy`を追加するとRun時にデプロイできるSchemeが作れる。

```sh
Publishing t__nabe1478's Blog (1 steps)
[1/1] Deploy using Git (git@github.com:tanabe1478/tanabe1478.github.io.git)
✅ Successfully published t__nabe1478's Blog
```

### GitHub Pagesでホスティング

静的なファイルのホスティング先は色々検討したがデフォルトでサポートされているGitHub Pagesを利用することにした。

```swift
try Blog().publish(using: [
    .installPlugin(.highlightJS()),
    .addMarkdownFiles(),
    .generateHTML(withTheme: .myTheme),
    .optional(.copyResources()),
    .sortItems(by: \.date, order: .descending),
    .generateRSSFeed(including: [.posts]),
    .generateSiteMap(),
    .deploy(using: .gitHub("tanabe1478/tanabe1478.github.io", useSSH: true)), // パイプラインにGitHub Pagesへのデプロイを追加
])

```

### 使った感触

出来て日が浅いOSSなのでドキュメントが足りない所もあるし、日本で使ってる人がいないのか日本語の情報は全くない。それでもドキュメントの英語は平易で、コードも読みやすいのでコードを追いながらデフォルトのテーマから自分用のテーマを作るのは難しくなかったが、publishしている部分のパイプラインやプラグインの作り方など知っておいた方が良いことがまだある。

それでもWebに公開するコンテンツを作るのにSwiftの世界でほぼ完結出来るのは最高だった。iOSアプリ以外でもSwiftをもっと使いたくなってしまった。

## 今後やりたいこと

- 独自ドメインにする
- プラグインを作ってみたい
- CSSを整えたい
- シンタックスハイライト用のCSSの見直し

## Developers.IOに書いた

- [Swiftでブログを作ってGitHub Pagesにデプロイしてみる | Developers.IO](https://dev.classmethod.jp/articles/generate-static-site-in_swift/)
