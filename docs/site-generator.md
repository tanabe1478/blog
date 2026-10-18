# Site generator

このrepositoryは、自分のMoonBit module `site/`で静的siteを生成します。[moonbit-ssg](https://github.com/tanabe1478/moonbit-ssg)は汎用libraryとして使うだけで、このblog固有の設定やthemeはmoonbit-ssg側に持たせません。

## 構成

```text
moon.work               MoonBit workspace。site と vendor/moonbit-ssg を member にする
mise.toml               MoonBit toolchainの固定（vendor/moonbit-ssg/mise.toml と同じ値）
site/
  moon.mod              module tanabe1478/blog。tanabe1478/moonbit-ssg@0.1.0 を import
  src/config.mbt        site名・説明・URL・SNS・Analytics
  src/theme.mbt         各pageのHTML（PublishHTMLFactory）
  src/url.mbt           HTML escapeとURL組み立て
  src/build.mbt         読み込み → HTML → RSS/sitemap → Resources copy
  cmd/build/            CLI: build CONTENT RESOURCES OUTPUT [BUILD_DATE]
  tests/                themeのblack-box test
vendor/moonbit-ssg      git submodule。使うcommitはsubmoduleが固定する
Resources/MyHtmlTheme/  CSS。styles.css は /styles.css にもcopyされる
```

`moon.mod`はlocal path依存を書けないため、`moon.work`のworkspaceで`tanabe1478/moonbit-ssg`をsubmoduleへ解決します。mooncakesへの公開は不要です。

## 生成の流れ

`scripts/build_site.sh`は`moon run site/cmd/build`を実行します。

1. `@ssg.load_published_content`で`Content/`を読む。`posts/`だけをsectionとして扱い、他のMarkdownはpageになる。
2. `@ssg.generate_publish_html`に`site/src/theme.mbt`のfactoryを渡し、`/`、`/posts/`、`/posts/<slug>/`、`/tags/`、`/tags/<tag>/`を書き出す。
3. `@ssg.render_publish_rss_feed`と`@ssg.render_publish_sitemap`で`feed.rss`と`sitemap.xml`を書き出す。
4. `Resources/`をそのままcopyし、`MyHtmlTheme/styles.css`を`/styles.css`へcopyする。

## 変更する場所

| 変えたいもの | 場所 |
| --- | --- |
| 色・余白・font | `Resources/MyHtmlTheme/styles.css` |
| pageのHTML構造、並び順、表示項目 | `site/src/theme.mbt` |
| site名・説明・SNS link・Analytics ID | `site/src/config.mbt` |
| sectionやfeed、出力file | `site/src/build.mbt` |

どれもこのrepositoryだけで完結します。pushすればDeploy Blogが走ります。

## 確認

```bash
mise exec -- moon fmt --check
mise exec -- moon test          # site と vendor/moonbit-ssg の test
scripts/prepare_for_deploy.py --skip-images
```

HTMLを変えない整理では、同じ`BUILD_DATE`で変更前後を生成して`diff -r`で比べます。

```bash
BLOG_OUTPUT_DIR=/tmp/before scripts/build_site.sh 2026-01-01T00:00:00+0900
# 変更後
BLOG_OUTPUT_DIR=/tmp/after scripts/build_site.sh 2026-01-01T00:00:00+0900
diff -r /tmp/before /tmp/after
```

## clone直後

submoduleも取得します。

```bash
git clone --recurse-submodules https://github.com/tanabe1478/blog
# 既にcloneしている場合
git submodule update --init
mise trust && mise install
```

## moonbit-ssgを更新する

submoduleのcommitを進め、その結果をこのrepositoryでcommitします。

```bash
git -C vendor/moonbit-ssg fetch origin
git -C vendor/moonbit-ssg checkout <commit>
mise exec -- moon test
scripts/build_site.sh
git add vendor/moonbit-ssg
```

toolchainが変わった場合は`vendor/moonbit-ssg/mise.toml`の`[tools]`と`[env]`を`mise.toml`へ反映します。

SSG自体を同時に直す場合は、`vendor/moonbit-ssg`の中でbranchを作ってcommitし、moonbit-ssgへpushしてからこのrepositoryでsubmoduleの参照をcommitします。push前のcommitを参照したままpushすると、CIはsubmoduleを取得できません。

## 2026-10の移行

以前はmoonbit-ssg側に`tanabe1478/blog`専用adapter（`SiteConfig`、`theme.mbt`、`build` command）があり、このrepositoryは隣のcheckoutと`.moonbit-ssg-revision`でそれを呼んでいました。設定とthemeをこのrepositoryへ移し、moonbit-ssgからadapterを削除しました。

同じ`BUILD_DATE`で旧adapterと出力を比べ、HTMLと`feed.rss`は全file一致しました。意図して変えたのは次の2点です。

- `tags/ゲーム`のdirectory名がNFDからNFCになり、HTML内のlinkと一致した。
- sitemapの`lastmod`が全件build日から各記事の日付になった。
