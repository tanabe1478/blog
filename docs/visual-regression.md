# Visual regression test

この repository では、ブログ統合やテーマ変更で見た目が意図せず変わらないように Playwright の screenshot test を使います。

## 実行方法

初回のみ、Playwright の browser を install します。

```bash
npm install
npx playwright install chromium
```

通常の確認は次の command です。

```bash
npm run test:visual
```

この command は内部で次を行います。

1. `swift run` で Swift Publish site を生成する。
2. `Output/` を Python の static server で配信する。
3. Chromium で対象ページを開く。
4. 保存済み screenshot と現在の screenshot を比較する。

## baseline を更新する場合

見た目の変更が意図したものである場合だけ、baseline screenshot を更新します。

```bash
npx playwright test --update-snapshots
```

更新後は screenshot の差分を確認してから commit します。

## 現在の対象

- `/` — トップページ

今後、記事一覧、記事詳細、タグページを少しずつ追加します。
