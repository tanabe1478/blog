# Deploy

この repository の生成結果は `tanabe1478/tanabe1478.github.io` repository へ push して公開します。

## 通常の deploy

普段は次の 1 コマンドを使います。

```bash
scripts/publish_blog.py
```

この script は次を行います。

1. `scripts/prepare_for_deploy.py`でlocal imageのGyazo化とSwift referenceの`Output/`生成を行う。
2. source repositoryの変更をcommit / pushする。
3. MoonBit candidateを`Output.moonbit/`へ生成し、`Output/`とのbyte parityを検証する。
4. `tanabe1478/tanabe1478.github.io`の`master` branchを一時directoryにcloneする。
5. 検証済み`Output.moonbit/`の中身をdirectory構造を保ったままrsyncする。
6. 変更があれば`Publish site` commitを作ってpushする。
7. `scripts/check_public_site.py`をretry付きで実行する。

低レベルな deploy だけを実行したい場合は次を使います。

```bash
scripts/deploy_site.sh --check
```

## GitHub Actions deploy

`main`のblog sourceが更新されると、`.github/workflows/deploy-blog.yml`が自動的にsiteを生成し、`tanabe1478/tanabe1478.github.io`の`master`へ同期します。CMSから`Content/posts/*.md`を保存した場合も対象です。

workflowは次を実行します。

1. Python script testを実行する。
2. `scripts/prepare_for_deploy.py --skip-images`でSwift reference siteを生成・検査する。
3. commit SHAで固定したMoonBit SSGとtoolchainを用意する。
4. MoonBit candidateを生成し、Swift referenceとのbyte parityを検証する。
5. 公開repositoryを一時directoryへcheckoutする。
6. 検証済み`Output.moonbit/`を`rsync --delete`で同期する。
7. 差分があれば`github-actions[bot]`としてcommit・pushする。
8. GitHub Pages反映を待ちながらpublic smoke checkをretryする。

公開repositoryへの認証にはGitHub Actions Secret `BLOG_DEPLOY_TOKEN`を使います。このfine-grained tokenは`tanabe1478/tanabe1478.github.io`だけに`Contents: Read and write`を持たせ、source repositoryや他の権限を含めません。

CIでは外部副作用を避けるため、local画像のGyazo uploadを行いません。CMSから追加する画像は保存前にGyazo URLへ変換済みであることを前提にします。

## deploy 前の prepare

`publish_blog.py` は最初に `scripts/prepare_for_deploy.py` を実行します。

これにより、local image を Gyazo URL に置換してから site を生成します。

local imageがなく、置換が不要な場合もSwift referenceをbuildした後、MoonBit candidateとのbyte parityを確認してからdeployします。

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
