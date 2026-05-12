# Deploy

この repository の生成結果は `tanabe1478/tanabe1478.github.io` repository へ push して公開します。

## 通常の deploy

普段は次の 1 コマンドを使います。

```bash
scripts/publish_blog.py
```

この script は次を行います。

1. `scripts/prepare_for_deploy.py` で local image の Gyazo 化と `Output/` 生成を行う。
2. source repository の変更を commit / push する。
3. `tanabe1478/tanabe1478.github.io` の `master` branch を一時 directory に clone する。
4. `Output/` の中身を directory 構造を保ったまま rsync する。
5. 変更があれば `Publish site` commit を作って push する。
6. `scripts/check_public_site.py` を retry 付きで実行する。

低レベルな deploy だけを実行したい場合は次を使います。

```bash
scripts/deploy_site.sh --check
```

## deploy 前の prepare

`publish_blog.py` は最初に `scripts/prepare_for_deploy.py` を実行します。

これにより、local image を Gyazo URL に置換してから site を生成します。

local image がなく、置換が不要な場合はそのまま `swift run` 相当の build だけが行われます。

## なぜ Publish built-in deploy を使わないか

この repository では Publish の built-in Git deploy step を使うと、環境によって `posts/diary-34` のような directory が `postsdiary-34` のように flatten された path として deploy されることがありました。

その状態では GitHub Pages 上で次の URL が 404 になります。

```text
/posts/diary-34/
```

そのため、deploy は `Output/` をそのまま rsync する script に寄せます。

## diary path について

`/diary/` は `tanabe1478/diary` repository の GitHub Pages project site として配信されています。

blog 統合後は、diary repository 側を redirect site に変更しています。

```text
/diary/             -> /
/diary/articles/34  -> /posts/diary-34/
```

user site 側にも `Output/diary/...` の redirect page を生成していますが、project site が有効な間は diary repository 側の redirect が優先されます。

移行後の記事本体は次で表示できます。

```text
/posts/diary-34/
```
