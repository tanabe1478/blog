# Deploy

この repository の生成結果は `tanabe1478/tanabe1478.github.io` repository へ push して公開します。

## 通常の deploy

```bash
scripts/deploy_site.sh
```

この script は次を行います。

1. `swift run` で `Output/` を生成する。
2. `tanabe1478/tanabe1478.github.io` の `master` branch を一時 directory に clone する。
3. `Output/` の中身を directory 構造を保ったまま rsync する。
4. 変更があれば `Publish site` commit を作って push する。

## なぜ Publish built-in deploy を使わないか

この repository では Publish の built-in Git deploy step を使うと、環境によって `posts/diary-34` のような directory が `postsdiary-34` のように flatten された path として deploy されることがありました。

その状態では GitHub Pages 上で次の URL が 404 になります。

```text
/posts/diary-34/
```

そのため、deploy は `Output/` をそのまま rsync する script に寄せます。

## diary path について

`/diary/` は現在 `tanabe1478/diary` repository の GitHub Pages project site として配信されています。

そのため、user site 側の `Output/diary/...` に redirect page を置いても、project site が有効な間は `/diary/` 以下では diary project site が優先されます。

旧 diary URL を本当に redirect したい場合は、次のどちらかが必要です。

1. `tanabe1478/diary` 側を redirect site に変更する。
2. `tanabe1478/diary` の GitHub Pages を停止し、user site 側の `/diary/...` を有効にする。

現時点では、移行後の記事本体は次で表示できます。

```text
/posts/diary-34/
```
