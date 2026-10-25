# Inline Markdown editor

CMSの記事編集とHome / About編集は、Markdown textareaとpreviewの2ペインではなく、CodeMirror 6を使った1画面のinline editorです。Typoraのように、Markdownを書きながら見出しや強調をその場で確認できます。

read-onlyの記事detailは従来どおり`MarkdownArticle`（`react-markdown` + `remark-gfm`）で描画します。editorは編集画面だけに読み込みます。

## 基本設計

- Markdown sourceを唯一の正本にします。rich textへ変換して保存しません。
- editorの内容は`state.sliceDoc()`で文字列へ戻し、そのままAPIへ送ります。`doc.toString()`は改行を正規化するため使いません。
- 入力に合わせてReact stateを更新しますが、入力中のeditorを再生成しません。
- 表示だけをCodeMirrorのdecorationで変えます。隠した記法は、カーソルがその行へ来ると再表示します。
- 未変更のMarkdownを整形しません。frontmatterもrawのまま表示し、Pinnedなどの操作だけ`ui/src/frontmatter.ts`で対象行を書き換えます。

## 記法ごとの表示

| 記法 | 編集中の表示 |
| --- | --- |
| frontmatter | 等幅・淡色のsource block。常にraw表示 |
| ATX / Setext heading | 見出しサイズと太字。inactive lineでは`#`を隠す |
| strong / emphasis / strikethrough | 太字・斜体・打ち消し線。inactive lineではdelimiterを隠す |
| inline code | 背景付き等幅。inactive lineではbacktickを隠す |
| link | link色と下線。inactive lineでは`[]()`を隠す |
| image | inactive lineでは画像widget。active lineではMarkdown source |
| fenced code | 等幅のcode block。言語名badgeを表示 |
| Mermaid fence | sourceのまま。`mermaid` badgeを表示し、図は描画しない |
| blockquote | 左border。inactive lineでは`>`を隠す |
| `> youtube ...` | `>`を残し、YouTube badgeを表示。iframeは埋め込まない |
| list / task list | markerを見やすさのため残し、淡色表示 |
| horizontal rule | 淡色の区切りとして表示 |
| table / raw HTML | sourceのまま等幅block。HTMLは実行しない |

複雑なnested listやextensionの解釈はLezerのMarkdown parserに従います。公開siteのHTMLとpixel単位で一致するWYSIWYGではありません。公開表示との差はCMS-011で扱います。

## frontmatter

frontmatterはeditorの先頭にそのまま表示します。Pinnedのcheck / uncheckでは`pinned: true`行だけを追加・削除し、他の行と並び順を維持します。

`ui/src/frontmatter.ts`はLFと一貫したCRLFの両方を扱います。frontmatter、先頭heading、本文の位置を返すhelperは、CodeMirrorの位置（改行を1文字として数える）へ変換して返します。

## 画像

- file picker、drag-and-drop、pasteで1枚ずつuploadできます。
- 10MBを超える画像はupload前に拒否します。
- upload中の入力でcaretが動いても、挿入位置は`ui/src/editor/anchors.ts`のanchorとして追従します。
- editorの読み込み前にpickerを開いた場合は、upload完了時のcaretへfallbackします。
- 画像commitは記事保存とは独立しています。編集をcancelしてもupload済み画像は残ります。

`/images/...`は`raw.githubusercontent.com`の`main`から表示するため、deploy前でもeditor内で確認できます。

## 改行code

一貫したCRLFの文書はCRLFのまま編集・保存します。LFとCRLFが混在する文書は、既存helperと同じくLFへfallbackします。

CodeMirrorの内部位置は改行を1文字として数えるため、文字列offsetとの変換を`ui/src/textPosition.ts`で行います。frontmatterの範囲、Pinnedによる外部更新、画像挿入のすべてでこの変換を使います。

## CSP

CodeMirrorはtheme CSSを実行時に`<style>`へ注入します。CSPの`style-src`を緩めずに済むよう、Workerがresponseごとにnonceを発行し、次の両方へ設定します。

- HTMLの`<meta name="csp-nonce">`
- `Content-Security-Policy` headerの`style-src 'nonce-...'`

editorは`EditorView.cspNonce`へnonceを渡します。`'unsafe-inline'`は追加していません。CSP testでは、実際に適用された`.cm-content`のstyleとnonce付き`<style>`を確認します。

## lazy loading

`MarkdownEditor`は`React.lazy`で読み込みます。記事detailのread-only表示ではCodeMirror chunkを取得せず、**編集**を押した時点で取得します。Home / Aboutの編集画面も同じです。

CodeMirror + Markdown parserのchunkは約504 kB（gzip約176 kB）で、Viteの500 kB warningを超えます。editor専用のlazy chunkであり、初期表示には含まれないため、現時点では許容しています。さらに分割する場合は、language supportかcommandsを別chunkにしてください。

## 主なfile

| File | 役割 |
| --- | --- |
| `cms/ui/src/editor/MarkdownEditor.tsx` | Reactとのlifecycle、value同期、read-only、imperative handle |
| `cms/ui/src/editor/extensions.ts` | Markdown language、keymap、drop / paste、CSP nonce、更新通知 |
| `cms/ui/src/editor/livePreview.ts` | decoration仕様を生成する純粋関数 |
| `cms/ui/src/editor/livePreviewPlugin.ts` | 仕様をCodeMirror decorationへ変換 |
| `cms/ui/src/editor/widgets.ts` | 画像、badgeのwidget |
| `cms/ui/src/editor/anchors.ts` | upload中の挿入位置を追従するStateField |
| `cms/ui/src/editor/insert.ts` | 画像Markdownの挿入と改行判定 |
| `cms/ui/src/editor/textChange.ts` | React stateとの最小差分 |
| `cms/ui/src/textPosition.ts` | 文字列offsetとCodeMirror位置の変換 |
| `cms/ui/src/editor/nonce.ts` | CSP nonceの読み取り |
| `cms/ui/src/editor/editor.css` | editorとMarkdown表示のstyle |

## 確認

```bash
cd cms
npm run check
```

`npm run check`はUI build、3つのTypeScript project、Vitest、Playwrightを実行します。

inline editor専用のE2E:

```bash
npx playwright test --grep "Markdown inline|CSP nonce|CodeMirror chunk|captured anchor|CRLF|Japanese IME"
```

確認している内容:

- heading、strong、emphasis、inline code、strike、link、image、Mermaid badge、quote、listのinline表示
- active lineでraw記法へ戻ること
- 編集中にpreview paneが存在しないこと
- CSP nonceがmeta、header、CodeMirrorの`<style>`で一致すること
- read-only detailではCodeMirror chunkを取得しないこと
- upload中に入力しても画像が元のanchorへ入ること
- CRLFのround-tripとPinnedによるCRLF frontmatter更新
- 日本語IME composition
- draft、保存、競合、Pinned、画像、rename、deleteなど既存flow

手元で見た目を確認する場合:

```bash
cd cms
npm run dev
```

記事detailを開き、**編集**を押して次を確認します。

1. 見出しや強調がその場で変わる。
2. カーソルを合わせた行だけ`#`や`**`が見える。
3. 画像がeditor内に表示され、その行へカーソルを置くとMarkdownへ戻る。
4. 画像を選んでも、upload中に入力した本文が消えない。
5. cancelで元の記事へ戻る。

実画像uploadは`Resources/images/`へcommitするため、確認目的で行う場合は不要な画像を残さないでください。
