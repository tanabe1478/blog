# Markmesh extension CMS design

ブログ用 CMS は、独立した Desktop Writer アプリとしては作りません。

Markmesh の extension として定義し、Markmesh 本体には一般化できる extension API だけを追加します。

## 作らないもの

- diary に含まれていた Electron Desktop Writer の移植
- blog 専用の standalone Mac app
- Markmesh 本体に tanabe1478 blog 固有機能を直接入れること

## 作るもの

```text
Markmesh 本体
  └─ 汎用 extension API

blog CMS extension
  ├─ New Post
  ├─ Upload Image to Gyazo
  ├─ Insert Markdown Image
  ├─ Build Blog
  ├─ Open Preview
  ├─ Commit
  └─ Push
```

## extension の責務

blog CMS extension は、この blog repository の構造を知っています。

```text
postsDir: Content/posts
buildCommand: swift run
previewDirectory: Output
deployCommand: scripts/deploy_site.sh
imageProvider: Gyazo
```

この repository では、将来の extension が読むための初期設定を次に置きます。

```text
.markmesh/extensions/tanabe-blog.yml
```

記事作成時は `Content/posts/*.md` を生成し、画像挿入時は Gyazo に upload して Markdown に URL を挿入します。

## Markmesh 本体の責務

Markmesh 本体は blog を知りません。

本体が提供するのは、他の extension でも使える汎用機能だけです。

- command palette への command 登録
- active vault の file read/write
- editor への text insertion
- secure secret storage
- network permission
- shell task execution
- git status / commit / push

## Gyazo token

Gyazo access token は repository に保存しません。

```text
NG:
  .env
  .markmesh config
  frontmatter
  extension source

OK:
  Markmesh secret storage
  macOS Keychain などの OS secure storage
```

## diary 旧 Desktop Writer との関係

旧 Desktop Writer は、GitHub Issue 作成・更新と画像 upload を行うための道具でした。

移行後は GitHub Issues を記事 source にしないため、旧 Desktop Writer の機能はそのまま必要ありません。

対応関係:

| 旧 Desktop Writer | Markmesh extension |
|---|---|
| GitHub Issue 作成 | `Content/posts/*.md` 作成 |
| GitHub Issue 更新 | Markdown file 編集 |
| `public/uploads` への画像 commit | Gyazo upload |
| GitHub Actions trigger | git commit / push |

## 最初の実装単位

1. Markmesh extension API に command registration を追加する。
2. blog CMS extension の skeleton を作る。
3. `Blog: New Post` を実装する。
4. secret storage API を追加する。
5. `Blog: Upload Image to Gyazo` を実装する。
6. build / preview / git 操作を追加する。
