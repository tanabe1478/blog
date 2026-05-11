# blog 統合計画

この文書は、現在分かれている `blog` と `diary` を統合し、Markmesh extension を CMS として使えるようにするための計画です。

## 目的

- ホームページとブログをこの `blog` repository に集約する。
- GitHub Issues に記事を書く運用をやめ、Markdown file を正本にする。
- Markmesh を CMS として使う。ただし、ブログ固有機能は Markmesh 本体に入れず extension として実装する。詳細は `docs/markmesh-extension-cms.md` に整理する。
- 画像は Gyazo にアップロードし、Markdown には Gyazo の画像 URL を挿入する。
- 見た目の確認は agent-browser を主に使い、必要になった段階で自動 screenshot test を検討する。
- 実装は学習しやすい小さなコミットに分ける。

## 現在の前提

### blog repository

- Swift Publish 製の静的サイト。
- 記事は `Content/posts/*.md` に置かれている。
- 画像は現在 `Resources/images/` に置かれている。
- 出力先は `Output/`。

### diary repository

- GitHub Issues を記事として扱う Next.js 製ブログ。
- diary 側にあった Desktop Writer / Electron 執筆アプリは移行対象にしない。
- 今後の CMS は Markmesh extension として定義する。
- diary の記事は最終的に `Content/posts/` へ Markdown として移行する。
- diary の公開記事 URL と GitHub Issues / image upload commit の関係は `docs/diary-migration-sources.md` に整理する。
- diary の UI は現在の Swift Publish 側とかなり違うため、blog 全体を diary UI に寄せる。詳細は `docs/diary-ui-notes.md` を参照する。

### Markmesh

- Markdown-first / Files-first / Git-first のデスクトップアプリ。
- 一般リリース予定があるため、個人ブログ固有機能を本体へ入れない。
- 本体には汎用 extension API を追加し、ブログ CMS は extension として実装する。

## 全体アーキテクチャ

```text
Markmesh
  ├─ 汎用 extension host
  ├─ workspace file API
  ├─ editor insertion API
  ├─ secret storage API
  ├─ task runner API
  └─ git API

blog CMS extension
  ├─ New Post
  ├─ Gyazo Upload Image
  ├─ Build Blog
  ├─ Preview Blog
  ├─ Open in agent-browser
  └─ Commit / Push

blog repository
  ├─ Content/posts/*.md
  ├─ Package.swift
  ├─ Sources/Blog/...
  └─ Output/
```

## 画像アップロード方針

画像は repository 内に保存せず、Gyazo API にアップロードする。

Markdown には次のどちらかの形式で挿入する。

```markdown
![alt](https://i.gyazo.com/xxxx.png)
```

または Gyazo ページへのリンク付きで挿入する。

```markdown
[![alt](https://i.gyazo.com/xxxx.png)](https://gyazo.com/xxxx)
```

Gyazo access token は repository に保存しない。Markmesh の secret storage API 経由で安全に保存する。

## Markmesh 本体に必要な汎用 extension API

ブログ固有名は使わず、一般機能として追加する。

### commands API

Command Palette に extension command を登録する。

```ts
api.commands.registerCommand({
  id: 'blog.newPost',
  title: 'Blog: New Post',
  run: async () => {},
})
```

### workspace file API

vault 内の file を読み書きする。

```ts
await api.workspace.createFile('Content/posts/example.md', content)
await api.workspace.writeFile('Content/posts/example.md', content)
await api.workspace.readFile('Content/posts/example.md')
await api.workspace.listFiles('Content/posts', { glob: '*.md' })
```

### editor API

現在の editor に Markdown を挿入する。

```ts
await api.editor.insertText('![alt](https://i.gyazo.com/example.png)')
```

画像 drag & drop を extension が処理できる hook も検討する。

```ts
api.editor.onImageDrop(async ({ file, insertMarkdown }) => {
  const uploaded = await uploadToGyazo(file)
  insertMarkdown(`![${file.name}](${uploaded.url})`)
})
```

### secrets API

Gyazo token のような secret を安全に扱う。

```ts
await api.secrets.set('gyazo.accessToken', token)
const token = await api.secrets.get('gyazo.accessToken')
```

### task runner API

build、test、deploy のような外部 command を実行する。

```ts
await api.tasks.runShellCommand({
  command: 'swift run',
  cwd: await api.workspace.getVaultPath(),
})
```

shell 実行は危険なので、manifest の capability とユーザー確認を必須にする。

### git API

Markmesh の既存 Git 機能を extension から使える形で公開する。

```ts
await api.git.commit({ message: 'Add blog post: example' })
await api.git.push()
```

## Extension manifest 案

```json
{
  "id": "tanabe1478.blog",
  "name": "Tanabe Blog Publisher",
  "version": "0.1.0",
  "main": "dist/index.js",
  "capabilities": {
    "workspace": {
      "read": ["Content/posts/**", ".markmesh/**"],
      "write": ["Content/posts/**"]
    },
    "commands": true,
    "editor": ["insertText", "imageDrop"],
    "secrets": ["gyazo.accessToken"],
    "network": [
      "https://upload.gyazo.com/*",
      "https://api.gyazo.com/*"
    ],
    "shell": ["swift run"],
    "git": ["status", "commit", "push"]
  }
}
```

## blog extension 設定案

```yaml
# .markmesh/extensions/tanabe-blog.yml
postsDir: Content/posts
buildCommand: swift run
previewDirectory: Output

images:
  provider: gyazo
  markdownFormat: linked-image
  altTextFromFilename: true

defaultFrontmatter:
  description: ""
  tags:
    - 日記
```

## 実装フェーズ

### Phase 1: 現状固定

- 現在の blog の出力を確認する。
- agent-browser でトップページと代表記事を確認する手順を整理する。
- 見た目確認で見るべき観点を docs に残す。

### Phase 2: diary 移行設計

- 公開 diary URL と GitHub Issues API の対応を確認し、記事 Markdown を取得する方法を決める。
- issue number、title、created_at、body、comments、labels の移行ルールを決める。
- 既存 URL から新 URL への redirect 方針を決める。
- blog 全体を diary 風 UI に寄せるため、homepage、posts index、article page の変更順序を決める。

### Phase 3: Markmesh extension API 設計

- commands API の最小実装を設計する。
- workspace file API の権限境界を設計する。
- secrets API の保存先を決める。
- shell / network capability の permission model を設計する。

### Phase 4: blog CMS extension 実装

- `Blog: New Post` を実装する。
- `Blog: Set Gyazo Token` を実装する。
- `Blog: Upload Image to Gyazo` を実装する。
- `Blog: Build` と `Blog: Open Preview` を実装する。
- `Blog: Commit` と `Blog: Push` を実装する。

### Phase 5: diary 記事の移行

- 移行 script を作る。
- 少数の記事で変換結果を確認する。
- 全記事を移行する。
- agent-browser で見た目を確認する。

### Phase 6: 運用を固める

- GitHub Actions で build / deploy を実行する。
- Markmesh extension から publish workflow を実行できるようにする。
- diary 側の運用停止手順を整理する。

## 小さなコミット単位の例

1. `docs: add blog integration plan`
2. `docs: add agent-browser visual check guide`
3. `docs: describe diary issue migration rules`
4. `feat: add Markmesh command registration API draft`
5. `feat: expose workspace read API to extensions`
6. `feat: add secret storage API for extensions`
7. `feat: add Gyazo upload command to blog extension`
8. `feat: add new blog post command to blog extension`
9. `test: add migration script regression fixture`

各コミットは、ユーザーが diff を読んで理解できる大きさに保つ。

## 未決定事項

- diary の comment を本文末尾に移行するか、移行しないか。
- 新 URL を `/posts/{slug}/` にするか、`/diary/articles/{number}/` 互換を維持するか。
- Gyazo Markdown を direct image 形式にするか、linked image 形式にするか。現在の extension config では linked-image を初期値にしている。
- Markmesh extension の最初の配布形式を local extension にするか、GitHub URL install にするか。
- 自動 screenshot test が必要になった場合、Playwright などをどの範囲で再導入するか。
