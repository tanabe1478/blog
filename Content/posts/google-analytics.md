---
date: 2021-01-11 18:00
description: このサイトにGoogle Analyticsを導入したので経緯と手順
tags: 雑記,
---

# Google Analyticsを導入した

当サイトにGoogle Analyticsを導入しました。それほど多くの人が見に来ているわけではないこのサイトにGoogle Analyticsを導入した理由は、訪問されているページがあった時に見に来ている人にとってより役に立つような内容に適宜公開した記事を修正していける仕組みを作りたいと思ったからです。

アクセスの多い記事があって、その記事を後から修正するきっかけになると思って導入を考えました。

このは[以前紹介した](https://tanabe1478.github.io/posts/blog-structure/)通り、PublishというSwift製の静的サイトジェネレータを使って生成されていて、デプロイ先にはGitHub Pagesを使っています。また、PublishはできたばかりのOSSでまだまだ機能は不足しているものの拡張可能に作られているのでテーマやプラグインを自作することができます。

- [このサイトを生成しているPublish向けのYoutube埋め込みを表示するプラグインを作った](https://tanabe1478.github.io/posts/youtube-publish-plugin/)

Google Analyticsのトラッキングコードを埋め込むためにheadタグをカスタマイズしたかったのですが生成したノードに後からノードを追加する方法が現状のPublishでは提供されていません。

このノード、というのはPublishが依存しているPlotというHTMLなどをSwiftで記述できるよう製作されたDSLに登場する概念です。

後からノードを追加する機能をprivateに定義してheadタグの生成を行うメソッドを流用、変更してGoogle Analytics用のプラグインを作りました。

今回はYoutubeのときと違ってプラグインとしてコミュニティに公開しなかったのですが、すでに後からノードを作れるより汎用的な機能についての議論が進められていたからです。今後のPublishのアップデートで今回作った機能の大部分は不要になると思いますが、現状ないのは事実なので手元で拡張してそれを使っています。

実装を含めたものはDevelopers.IOで記事にしました。

- [Swiftでブログが作れるPublishで生成したサイトでGoogle Analyticsを利用できるようにする | Developers.IO](https://dev.classmethod.jp/articles/publish-google-analytics/)

少しずつ手入れをしながら記事を書くのは育成ゲームっぽくて楽しいです。


