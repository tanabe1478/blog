# Site generator

このrepositoryは、自分のMoonBit module `site/`で静的siteを生成します。[moonbit-ssg](https://github.com/tanabe1478/moonbit-ssg)は汎用libraryとして使うだけで、このblog固有の設定やthemeはmoonbit-ssg側に持たせません。

## 構成

```text
moon.work               MoonBit workspace。site と vendor/moonbit-ssg を member にする
mise.toml               MoonBit toolchainとNodeの固定（MoonBitはvendor/moonbit-ssg/mise.toml と同じ値）
site/
  moon.mod              module tanabe1478/blog。tanabe1478/moonbit-ssg@0.1.0 を import
  src/config.mbt        site名・説明・URL・SNS・Analytics
  src/theme.mbt         各pageのHTML（PublishHTMLFactory）
  src/content.mbt       抜粋・日付表記・Pinned・Recent・年ごとの一覧・tag件数
  src/url.mbt           HTML escapeとURL組み立て
  src/tokens.mbt        design/tokens.json → CSS変数
  src/build.mbt         読み込み → HTML → RSS/sitemap → Resources copy → /styles.css
  cmd/build/            CLI: build CONTENT RESOURCES TOKENS OUTPUT [BUILD_DATE]
  tests/                themeのblack-box test
vendor/moonbit-ssg      git submodule。使うcommitはsubmoduleが固定する
design/tokens.json      色・文字・余白などのdesign token（Penpotと共有する正本）
Resources/MyHtmlTheme/  CSS。値はvar(--...)で参照し、直接書かない
Resources/scripts/      code-blocks.js（コピーボタンとMermaidの「図 / コード」切り替え）
scripts/highlight/      Node。build後のOutput/のコードをShikiで色分けし、Mermaidの図をSVGにする
```

`moon.mod`はlocal path依存を書けないため、`moon.work`のworkspaceで`tanabe1478/moonbit-ssg`をsubmoduleへ解決します。mooncakesへの公開は不要です。

## 生成の流れ

`scripts/build_site.sh`は`moon run site/cmd/build`を実行します。

1. `@ssg.load_published_content`で`Content/`を読む。`posts/`だけをsectionとして扱い、他のMarkdownはpageになる。
2. `@ssg.generate_publish_html`に`site/src/theme.mbt`のfactoryを渡し、`/`、`/posts/`、`/posts/<slug>/`、`/tags/`、`/tags/<tag>/`を書き出す。`Content/about.md`は`/about/`になる。
3. `@ssg.render_publish_rss_feed`と`@ssg.render_publish_sitemap`で`feed.rss`と`sitemap.xml`を書き出す。
4. `Resources/`をそのままcopyする。
5. `design/tokens.json`を`tokens_css`でCSS変数に変換し、`MyHtmlTheme/styles.css`の前につなげて`/styles.css`に書き出す。`base`と`light`のsetが既定、`dark`は`prefers-color-scheme: dark`で効く。
6. `node scripts/highlight/build.mjs Output`でコードブロックを書き換える（下の「コードとMermaid」）。

## コードとMermaid

moonbit-ssgはコードを`<pre data-language="…">`のまま出力し、そのあと`scripts/highlight`が書き換えます。

- 言語付きのブロックはShiki（ビルド時）で色分けし、言語名とコピーボタンのバーを付ける。ShikiはCSS変数のthemeを使い、色は`color.syntax.*`のtoken。lightとdarkはCSS変数で切り替わるので、色分けは1回だけ。
- shellの引用符のない引数は文字列扱いにせず通常の文字色、`-d`のようなoptionはconstantの色にしている（`render.mjs`のtheme規則）。
- ` ```mermaid `のブロックは「図 / コード」の箱になる。図はbuildのときに`mermaid.mjs`がPlaywrightのChromiumでSVGにして埋め込むので、ページはmermaidのJavaScriptを読み込まない。描けなかった図はソースを表示する。
- 描くときは仮の色を使い、SVGの`<style>`の中でtokenのCSS変数（`--color-diagram-node`など）に置き換える。1つのSVGがlightとdarkの両方に合う。文字の幅はsiteと同じNoto Sans JPで測る。
- 描いたSVGは「ソース・mermaidの版・描画の設定」のhashで`.cache/mermaid/`に保存し、同じ図はChromiumを起動せずに使い回す。CIでは`actions/cache`で引き継ぐので、描くのは新しい図か変わった図だけ。描画の設定を変えたら`mermaid.mjs`の`RENDER_VERSION`を上げる。
- このsiteの見出しのclassは`section-label`。`label`のような一般的なclass名はMermaidなどのライブラリとぶつかるので使わない。

```bash
npm ci --prefix scripts/highlight
npm exec --prefix scripts/highlight -- playwright install chromium
npm test --prefix scripts/highlight   # node --test
```

## 変更する場所

| 変えたいもの | 場所 |
| --- | --- |
| 色・文字の大きさ・行の高さ・余白・幅・角丸の値 | `design/tokens.json` |
| どの要素にどのtokenを使うか、tokenにない細かな指定 | `Resources/MyHtmlTheme/styles.css` |
| topのProfile・RSS欄の文章 | `Content/index.md`（下のfrontmatter表を参照）。CMSの**Homeを編集**からも変えられる |
| Aboutの文章 | `Content/about.md`。CMSの**Aboutを編集**からも変えられる |
| topのPinnedに出す記事 | 記事のfrontmatterに`pinned: true`。CMSの編集画面のcheckboxでも切り替えられる |
| pageのHTML構造、並び順、表示項目 | `site/src/theme.mbt` |
| site名・説明・SNS link・Analytics ID | `site/src/config.mbt` |
| sectionやfeed、出力file | `site/src/build.mbt` |

どれもこのrepositoryだけで完結します。pushすればDeploy Blogが走ります。

## Contentのfrontmatter

moonbit-ssgのfrontmatterは1行1つの`key: value`だけを読みます。値の前後の`"`または`'`は1組だけ外し、escapeは解きません。themeが使うkeyは次のとおりです。

| file | key / 部分 | 表示する場所 |
| --- | --- | --- |
| `Content/index.md` | `profile` | Profile欄の1行目（handleなど） |
| | `rss` | RSS欄の案内文 |
| | 本文 | Profile欄の紹介文。先頭の`# `見出しは`<title>`用で表示しない |
| `Content/about.md` | `# 見出し` | Aboutのtitle |
| | `subtitle` | titleの下の1行 |
| | 本文 | 紹介文。`## `で区切った節も書ける |
| `Content/posts/*.md` | `date`、`description`、`tags` | 日付、抜粋、tag。`description`がtitleと同じか空なら本文の先頭を抜粋に使う |
| | `pinned: true` | topのPinnedにcardで出す（日付の新しい順） |

topのRecentは日付の新しい5件、`/posts/`は全記事を年ごとに並べます。

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

## Design token

`design/tokens.json`はPenpotがimport/exportする形式（最上位keyがset、tokenは`$type`と`$value`）です。

- 文字の大きさ・余白・幅はPenpotの都合でpxで書き、CSSではremに変換する（ブラウザの文字サイズ設定が効くように）。角丸はpxのまま。
- line-heightは単位なしの比率で書く。
- typographyは`--typography-<name>-font-family`などfamily・size・weight・style・line-heightの5変数になる。
- 変数名はtokenの階層を`-`でつないだもの（`color.text` → `--color-text`）。

tokenを追加したら`styles.css`から`var(--...)`で参照します。CSSに値を直接書くとPenpotとずれるので避けます。


### Penpotとの同期

Penpotのデザインファイルには`design/tokens.json`と同じtokenを取り込み、画面の文字・色・余白・幅・角丸にtokenを当てています。

- Penpotでtokenを変えたら、TokensのexportでJSONを書き出し、`design/tokens.json`を置き換えてcommitする。
- repository側で変えたら、PenpotのTokensのimportで取り込む。
- light / darkはPenpotのtheme（group `mode`）で切り替える。themeはfile全体で1つだけ有効なので、light用とdark用の画面を別に作らず、themeを切り替えて確認する。
- Penpotは`-apple-system`のように`-`で始まるfont名をtokenとして受け付けない。fallbackは`sans-serif`などの総称名にする。
- plugin（MCP）からtokenの値を変えた場合、適用済みのshapeには自動で反映されなかった。`shape.applyToken(token, ["typography"])`のようにshapeごとに当て直す。

#### Penpotファイルの構成（2026-10）

| page / board | 内容 |
| --- | --- |
| `Redesign / OmmWriter` | 今のデザイン。Desktop（Home・Post・Articles・About）とMobile / Homeのlight画面に色とtypographyのtokenを当てている |
| `Dark / Desktop / *` | light画面を複製し、色だけdarkの値を直接書いたもの。themeは1つしか有効にできないので、並べて見る用 |
| `Hover / *` | Desktop / Homeのhover状態。prototypeのoverlayとして使う |
| `Hover states` | 要素ごとのDefault / Hoverをcomponentのvariant（`State`）にし、時間とeasingを書いたもの |
| `Archive / Old design` | 旧デザイン。tokenを`legacy.*`（set `legacy/base`・`legacy/light`・`legacy/dark`）へ当て直して残している |

Hoverは、PenpotにSmart Animateのような補間がないため、Desktop / Homeの各要素にmouse-enterでhover状態のboardをoverlay表示（dissolve、ease-out、150〜300ms）し、overlay側のmouse-leaveで閉じる形で表現した。View modeのFlow「Home / Hover」で確かめられる。CSSでは同じ状態を`transition`で実装している。

時間は`design/tokens.json`の`duration`（fast 150・base 200・slow 300・enter 600・stagger 80）で決める。Penpotには時間のtoken型がないため`number`型で置き、`tokens_css`は最上位が`duration`のtokenだけを`ms`付きで出力する。表示時のアニメーション（sectionが順にfade inする）も同じtokenを使い、`prefers-reduced-motion: reduce`のときはhoverのtransitionと合わせて止める。

pluginから作業するときの注意:

- Penpotのtabが裏に回ると、browserがtabを止めてMCPが応答しなくなる。agent-browserの`--headed`で開いたtabを前面にしたまま使うと安定した。MCPの接続は、`/mcp`でReconnectした時点でつながっていたtabに結び付く。止まったときは、Penpotのmenu「MCP server → Disconnect → Connect」でつなぎ直してから`/mcp`でReconnectする（この順番でないと古い接続を見続ける）。応答が止まったと表示されても、処理自体は実行されていることがあるので、やり直す前に結果を確かめる。
- textの幅をlayout経由で変えても、表示上の折り返しは古い幅のまま残ることがある。boardを`viewport.zoomIntoView`で画面に出してから、line-heightを少し変えて戻すと計算し直される。
- overlayの`manualPositionLocation`は、trigger元がboardならそのboard、textやgroupなら一番近い親boardからの位置になる。
- tokenの名前を変えても、shape側の参照は古い名前のまま残る。shapeからtokenを外すAPIはなく、別の値を代入すると外れる（同じ値の代入では外れない）。
