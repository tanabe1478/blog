# diary migration sources

`diary` を `blog` に取り込むときの source を整理します。

## 記事の場所

公開されている記事は GitHub Pages 上の diary site です。

- index: https://tanabe1478.github.io/diary/
- article example: https://tanabe1478.github.io/diary/articles/34

移行時に UI や表示内容を確認するときは、この公開 URL を基準にします。

## 記事本文の source

`diary` は GitHub Issues を記事として扱う構成です。

そのため、Markdown 本文を移行するときは公開 HTML から逆変換するのではなく、可能な限り GitHub Issues API から取得します。

例:

- `https://tanabe1478.github.io/diary/articles/34`
- 対応する Issue: `https://github.com/tanabe1478/diary/issues/34`

移行対象:

- issue number
- issue title
- issue body
- created_at
- updated_at
- labels
- comments を移行するかどうかは別途判断

## 画像 upload commit について

`diary` repository には、次のような commit message が存在します。

```text
chore: upload blog image cc7bd6fd6ca83ce607b965a9aba5b584.png
```

これは記事そのものではなく、diary 側の旧 Desktop Writer / 画像アップロード処理が `public/uploads/...` に画像を追加した commit です。旧 Desktop Writer 自体は移行対象にせず、今後の CMS は Markmesh extension として実装します。

つまり、移行時には次のように分けて扱います。

```text
記事本文:
  GitHub Issue / diary public article

既存画像:
  diary repository の public/uploads/... または公開 URL

今後の新規画像:
  Gyazo API に upload し、Markdown には Gyazo URL を挿入
```

## 移行時の注意

既存 diary 記事内の画像 URL は、現在次のような形式になっています。

```markdown
![alt](https://tanabe1478.github.io/diary/uploads/YYYY-MM-DD/file.png)
```

移行時の扱い:

1. 外部サービス上の画像 URL は基本的にそのまま残す。
2. `https://tanabe1478.github.io/diary/uploads/...` の画像だけは `blog` repository に取り込む。
3. 今後の新規画像は Gyazo に upload し、Markdown URL を Gyazo URL にする。

`/diary/` は diary repository 側の redirect site に変更したため、旧 diary project site 配下の upload 画像は永続性が弱くなります。そのため、該当画像だけは保全目的で `/images/uploads/...` に移します。
