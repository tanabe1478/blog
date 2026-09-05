# Deploy

このrepositoryの生成結果は`tanabe1478/tanabe1478.github.io` repositoryへpushして公開します。site generatorは固定revisionのMoonBit SSGです。

## 通常のdeploy

普段は次の1 commandを使います。

```bash
scripts/publish_blog.py
```

このscriptは次を行います。

1. `scripts/prepare_for_deploy.py`でlocal imageをGyazo化する。
2. `scripts/build_site.sh`で`Output/`全体を生成する。
3. `scripts/check_output_site.py`で生成HTMLが参照するlocal assetを検査する。
4. source repositoryの変更をcommit / pushする。
5. `tanabe1478/tanabe1478.github.io`の`master` branchを一時directoryへcloneする。
6. `Output/`をdirectory構造を維持して`rsync --delete`する。
7. 変更があれば`Publish site` commitを作ってpushする。
8. `scripts/check_public_site.py`をretry付きで実行する。

低levelのdeployだけを実行する場合:

```bash
scripts/deploy_site.sh --check
```

`--skip-prepare`を指定する場合は、先に`Output/`を生成してください。

```bash
scripts/build_site.sh
scripts/deploy_site.sh --skip-prepare --check
```

## MoonBit SSGの固定

利用するrevisionは`.moonbit-ssg-revision`に保存します。localでは既定でsibling checkout `../moonbit-ssg`を利用します。

```bash
git clone https://github.com/tanabe1478/moonbit-ssg ../moonbit-ssg
git -C ../moonbit-ssg checkout "$(cat .moonbit-ssg-revision)"
scripts/build_site.sh
```

別のcheckout:

```bash
MOONBIT_SSG_DIR=/path/to/moonbit-ssg scripts/build_site.sh
```

固定revisionとcheckoutのHEADが異なる場合、buildは停止します。SSG自体の開発中だけ、明示的に次を指定できます。

```bash
MOONBIT_SSG_ALLOW_UNPINNED=true scripts/build_site.sh
```

## GitHub Actions deploy

`main`のblog sourceが更新されると、`.github/workflows/deploy-blog.yml`が自動的にsiteを生成し、`tanabe1478/tanabe1478.github.io/master`へ同期します。CMSから`Content/posts/*.md`を保存した場合も対象です。

workflow:

1. Python script testを実行する。
2. commit SHA固定のMoonBit SSGをcheckoutする。
3. miseで固定MoonBit toolchainをinstallする。
4. MoonBit SSGで`Output/`を生成する。
5. local asset checkを実行する。
6. 公開repositoryをcheckoutする。
7. `Output/`を`rsync --delete`で同期する。
8. 差分があれば`github-actions[bot]`としてcommit / pushする。
9. GitHub Pages反映を待ちながらpublic smoke checkをretryする。

公開repositoryへの認証にはGitHub Actions Secret `BLOG_DEPLOY_TOKEN`を使います。このfine-grained tokenは`tanabe1478/tanabe1478.github.io`だけに`Contents: Read and write`を持たせ、source repositoryや他の権限を含めません。

CIでは外部副作用を避けるためlocal画像をGyazoへuploadしません。CMSから追加する画像は保存前にGyazo URLへ変換済みであることを前提にします。

## deploy前のprepare

`publish_blog.py`は最初に`scripts/prepare_for_deploy.py`を実行します。local imageをGyazo URLへ置換し、MoonBit SSGでsiteを生成してasset checkを行います。

画像置換をせずbuildだけ確認する場合:

```bash
scripts/prepare_for_deploy.py --skip-images
```

## なぜ独自deploy scriptを使うか

過去にSwift Publishのbuilt-in Git deployで、`posts/diary-34`のようなdirectoryがflattenされる問題がありました。現在はgeneratorに依存せず、正規出力`Output/`をそのまま`rsync`する単純な経路を維持しています。

この方法では次のURLに必要なdirectory構造をそのまま保存できます。

```text
/posts/diary-34/
```

## diary path

`/diary/`は`tanabe1478/diary` repositoryのGitHub Pages project siteとして配信されています。blog統合後はdiary repository側をredirect siteに変更しています。

```text
/diary/             -> /
/diary/articles/34  -> /posts/diary-34/
```

user site側にも`Output/diary/...`のredirect pageを生成しますが、project siteが有効な間はdiary repository側のredirectが優先されます。
