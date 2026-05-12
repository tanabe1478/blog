# diary UI notes

`diary` を `blog` に移行するとき、単に記事データだけを移すと見た目が大きく変わる可能性があります。この文書は、現在の diary UI の特徴を移行時に忘れないためのメモです。

対象 URL:

- https://tanabe1478.github.io/diary
- https://tanabe1478.github.io/diary/articles/34

## 現在の diary UI の印象

`diary` は、現在の Swift Publish 側の blog UI よりかなりミニマルです。

大きな特徴:

- 白背景を基調にしたシンプルな中央カラム。
- 最大幅はおよそ `42rem` 程度で、かなり読みやすい幅に制限されている。
- header は背景色付きの帯ではなく、本文と同じ白背景に `tanabe1478` のテキストだけが置かれている。
- 記事一覧は card ではなく、日付 + title のシンプルな list。
- 日付は薄い gray、italic、tabular nums。
- title link は blue。
- footer は上 border と `Home` link のみ。
- dark mode に対応している。

## diary top page の構造

概念的には次のような構造です。

```text
body
└─ min-h-screen white/dark background
   └─ max-w-2xl centered container
      ├─ header
      │  └─ tanabe1478
      ├─ main
      │  └─ Articles
      │     └─ list
      │        ├─ date title
      │        ├─ date title
      │        └─ ...
      └─ footer
         └─ Home
```

記事一覧の見た目:

```text
2026-04-24  ブログを書くためのアプリを作った
2025-12-23  diary の改修
2025-03-04  GmailをGeminiにつなげる方法
```

## diary article page の構造

記事詳細は次の特徴があります。

- h1 は `text-2xl` 相当で大きすぎない。
- h1 下に日付と GitHub link が薄い gray で並ぶ。
- 本文は `.markdown` class で、段落間に十分な余白がある。
- 画像は本文幅に合わせ、上下に大きめの margin を取る。
- code、blockquote、list、heading の style が article 向けに整っている。

## 現在の blog UI との差分

現在の Swift Publish 側は、`Resources/MyHtmlTheme/styles.css` により次の特徴があります。

- header に gray background がある。
- `.wrapper` の最大幅が `900px` で diary より広い。
- article list が gray の rounded card になっている。
- tag が黒 background の pill として強く表示される。
- body が `text-align: center` を持ち、wrapper 内で左寄せに戻している。

そのため diary 記事をそのまま `Content/posts/` に入れるだけだと、diary のミニマルな見た目とはかなり印象が変わります。

## 移行時の注意点

移行時は、少なくとも次を検討します。

1. `diary` 由来の記事一覧を card UI にするか、diary と同じ date + title list にするか。
2. `/diary` path では diary 風 UI を維持し、既存 `/posts` は Publish 風 UI のままにするか。
3. 全体 theme を diary 寄りに寄せるか。
4. diary article の metadata 行（日付 + GitHub link 相当）をどう扱うか。
5. GitHub Issues をやめた後、旧 GitHub link を残すか、削除するか。
6. diary の uploaded image URL は、旧 diary project site 配下のものだけ blog 側 `/images/uploads/...` に保全する。
7. dark mode を blog 側でも diary と同程度に維持するか。

## agent-browser で確認する観点

移行作業時は、agent-browser で diary と移行後 blog を見比べます。

確認ページ:

- diary top: `https://tanabe1478.github.io/diary`
- diary article: `https://tanabe1478.github.io/diary/articles/34`
- 移行後の blog top / diary index / article page

見る観点:

- container 幅が広がりすぎていないか。
- header が重くなっていないか。
- article list が diary より情報量過多になっていないか。
- date の薄さ、link の青、余白が近いか。
- 記事本文の行間、段落間、画像余白が近いか。
- dark mode の印象が大きく崩れていないか。

## 採用方針

blog 全体を diary UI に寄せます。

つまり、diary 由来の記事だけでなく、既存の homepage / posts / article page もまとめてミニマルな UI に寄せます。

採用理由:

- repository 統合後の見た目に一貫性が出る。
- diary のほうが現在の執筆・閲覧体験に近い。
- editor に依存しない script-based workflow でも、記事中心の簡素な UI のほうが合う。

この方針により、既存 blog の見た目は変わります。変更時は agent-browser で確認し、どの UI 要素を diary に寄せたかを小さなコミットごとに説明します。
