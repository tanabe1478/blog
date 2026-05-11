---
date: 2026-04-24 04:09
description: ""
tags: diary
---

# ブログを書くためのアプリを作った

このブログは GitHub Issues を記事として扱っている。Issue を作ると GitHub Actions が走って、静的サイトとしてデプロイされる。

仕組みとしては気に入っているのだが、毎回 GitHub を開いて Issue を作り、本文を書いて、既存記事を直す時も Issue を探して編集するのが少し面倒になってきた。面倒になると書かなくなるので、ブログ記事を書くためのデスクトップアプリを作った。

Electron で Windows と Mac の両方で動くようにして、記事の新規投稿、既存記事の取得、編集、Markdown プレビューができるようにした。既存記事は GitHub Issues から取得して、編集したら同じ Issue に PATCH する。今までの CI はそのまま使えるので、アプリ側は GitHub Issue を作ったり直したりするだけで済む。

今回は Codex にかなり作業してもらった。実装だけではなく browser-use で画面を操作して、既存記事が実際に取得できることも確認した。Windows 向けの配布物も作れるところまで見た。

ブログを書くための道具を作るのにブログを書く手間がかかっていたので、こういう小さい道具を雑に作れるのは助かる。あとは実際に使い続けられるかどうか。この記事自体を、このツールの最初の動作確認にする。

![cc7bd6fd6ca83ce607b965a9aba5b584](/images/uploads/c13ae456-dfee-48db-aa1d-f31d0009ab6e-cc7bd6fd6ca83ce607b965a9aba5b584.png)

![aa5aaffa68d720321e11131bd20a19c7 (1)](/images/uploads/2faf82ad-5995-4d7f-b6a8-dcd182e774a2-aa5aaffa68d720321e11131bd20a19c7-1.png)
