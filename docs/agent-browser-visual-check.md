# agent-browser による見た目確認

この repository では、通常の見た目確認は agent-browser を主に使います。

Playwright のような自動 screenshot test は、必要になった段階で小さく再導入します。まずは仕組みを重くせず、AI と人間が同じ画面を見ながら確認できる状態を優先します。

## 目的

- diary 統合や theme 変更で、ホームページとブログの見た目が大きく崩れていないか確認する。
- agent がブラウザを見ながら、違和感やリンク切れを調査できるようにする。
- 確認観点を docs に残し、毎回の判断をブラックボックスにしない。

## 基本手順

1. site を生成する。

```bash
swift run
```

2. `Output/` を local server で配信する。

```bash
python3 -m http.server 4173 --directory Output
```

3. agent-browser で次を開く。

```text
http://127.0.0.1:4173/
```

## 最低限確認するページ

- `/` — ホームページ
- `/posts/` — 記事一覧
- 代表的な記事ページを 2〜3 件
- tags ページを使う場合は tags 関連ページ

## 確認観点

- header / footer の表示が崩れていないか。
- 文字サイズ、余白、リンク色が大きく変わっていないか。
- 記事一覧で title、description、tags が読めるか。
- 記事本文の Markdown が自然に表示されているか。
- 画像、code block、YouTube embed などがある記事で表示が壊れていないか。
- リンク先が意図した path になっているか。

## 記録方法

見た目確認をしたときは、作業報告に次を短く残します。

```text
見た目確認: agent-browser
確認ページ: /, /posts/, /posts/example/
結果: 大きな崩れなし
気づき: 記事一覧の description が長い記事では余白を後で確認したい
```

## 自動 screenshot test を再検討するタイミング

次のどれかに当てはまる場合は、Playwright などの自動 screenshot test を再導入します。

- theme や CSS を頻繁に変更する。
- GitHub Actions 上で見た目差分を機械的に止めたくなった。
- 複数人で編集するようになり、目視確認だけでは不安になった。
- diary 統合後、既存 URL や記事表示の互換性確認が増えた。
