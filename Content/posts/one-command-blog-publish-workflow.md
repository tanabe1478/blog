---
date: 2026-05-12 19:10
description: ブログ公開用のスクリプトを一つにまとめた
tags: 技術, 日記
---

# ブログ公開用のスクリプトを一つにまとめた

このブログは Swift Publish で生成して GitHub Pages に置いている。しばらく触っているうちに、記事を書くこと自体よりも、その後にやることが少し多くなっていた。

新しい記事を作る。Markdown を編集する。画像があれば Gyazo にアップロードする。`swift run` で生成する。source repository に commit する。`Output` を公開用 repository に反映する。公開後に見に行く。

一つ一つは難しくないが、ブログを書くたびに思い出すには少し面倒だった。面倒になると書かなくなるので、公開までを一つのスクリプトにまとめた。

```sh
scripts/publish_blog.py
```

今はこのコマンドで、記事フォルダ全体を対象にして画像のアップロード、Markdown の書き換え、ビルド、source repository の commit / push、GitHub Pages への deploy、公開後の smoke check まで行う。

## 記事フォルダ全体を同期する

最初は Markmesh の command として動かすことも考えていた。だが、実際に必要なのは現在開いているファイルだけを処理することではなかった。

トップページの記事一覧、feed、sitemap は `Content/posts` 全体から作られる。新着記事だけでなく、過去記事を直した場合も `Output` 全体を再生成する必要がある。

それなら editor に依存するより、repository の script を正にした方が良い。

## 画像も deploy 前にまとめて処理する

画像は執筆中は local file として参照しておいて、公開前に Gyazo URL へ置換するようにした。

この記事のスクリーンショットもそのテスト用に置いている。

[![publish workflow home screenshot](https://i.gyazo.com/14c96b474c78a9ec0f40e2eb70521e9b.png)](https://gyazo.com/14c96b474c78a9ec0f40e2eb70521e9b)

`publish_blog.py --dry-run` を実行すると、こういう local image が upload 対象として検出される。実際の公開時には Gyazo に upload され、Markdown の URL が差し替わる。

## 今回の動作確認

今回の変更では、トップページに X と GitHub のアイコンリンクを追加した。最初は SVG のサイズ指定が足りず、公開ページでアイコンが大きく表示された。実際に公開先を Chrome で見て気付いたので、`img` 側にも `width` / `height` を指定して直した。

その後、クラスメソッドの著者ページへのリンクも置いていたが、これは不要だったので消した。

公開先で確認したトップページは次のようになっている。

- X と GitHub のアイコンリンクだけが表示される
- 記事一覧の前に置かれる
- アイコンが大きくなりすぎない

こういう UI の確認と、記事内画像の検出をこの記事自体で試せるので、一通りの導線は見られるようになったと思う。

## これから

ブログを書くための手順はかなり軽くなった。あとは実際にこの形で記事を増やしていきたい。

Swift Publish まわりもまだ触る余地がある。最近 SwiftWasm も気になっているので、このブログや小さいツールのどこかで WebAssembly 対応もやってみたい。
