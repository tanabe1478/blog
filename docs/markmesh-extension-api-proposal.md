# Markmesh extension API proposal for blog CMS

blog CMS extension を実装するために、Markmesh 本体へ追加したい汎用 extension API の提案です。

この文書は `blog` 側の要求仕様です。実装は `tolaria` / Markmesh repository で行います。

## 前提

- blog 固有機能は Markmesh 本体に入れない。
- Markmesh 本体は一般リリース予定なので、他の extension でも使える API として設計する。
- extension は capability manifest で権限を宣言する。
- 危険な操作、特に shell / network / secret / git push はユーザー確認または明示的 permission を必要にする。

## 最小 API set

### commands

Command Palette に extension command を登録する。

```ts
api.commands.registerCommand({
  id: 'tanabe-blog.newPost',
  title: 'Blog: New Post',
  run: async () => {},
})
```

必要な理由:

- `Blog: New Post`
- `Blog: Upload Image to Gyazo`
- `Blog: Build`
- `Blog: Open Preview`
- `Blog: Commit`
- `Blog: Push`

を Markmesh の通常操作として呼び出したい。

### workspace

active vault 内の file を安全に読み書きする。

```ts
const vaultPath = await api.workspace.getVaultPath()
await api.workspace.readFile('Content/posts/diary-34.md')
await api.workspace.createFile('Content/posts/my-post.md', markdown)
await api.workspace.writeFile('Content/posts/my-post.md', markdown)
await api.workspace.listFiles('Content/posts', { glob: '*.md' })
```

必要な permission:

```json
{
  "workspace": {
    "read": ["Content/posts/**", ".markmesh/**"],
    "write": ["Content/posts/**"]
  }
}
```

### editor

現在の editor に Markdown text を挿入する。

```ts
await api.editor.insertText('![alt](https://i.gyazo.com/example.png)')
```

画像 drag & drop を extension が処理できる hook も必要です。

```ts
api.editor.onImageDrop(async ({ file, insertMarkdown }) => {
  const uploaded = await uploadToGyazo(file)
  insertMarkdown(`![${file.name}](${uploaded.url})`)
})
```

### secrets

Gyazo access token を repository に保存せず扱う。

```ts
await api.secrets.set('gyazo.accessToken', token)
const token = await api.secrets.get('gyazo.accessToken')
await api.secrets.delete('gyazo.accessToken')
```

保存先候補:

- macOS Keychain
- OS secure storage
- Tauri plugin 経由の secure storage

NG:

- vault 内の plain text file
- `.markmesh` config
- frontmatter
- extension source

### network

Gyazo API へ upload する。

```ts
const response = await api.network.fetch('https://upload.gyazo.com/api/upload', {
  method: 'POST',
  body: formData,
})
```

permission:

```json
{
  "network": [
    "https://upload.gyazo.com/*",
    "https://api.gyazo.com/*"
  ]
}
```

### tasks

build / preview server などの command を実行する。

```ts
await api.tasks.runShellCommand({
  command: 'swift run',
  cwd: await api.workspace.getVaultPath(),
})
```

初期実装では allowlist された command のみ実行可能にする。

```json
{
  "shell": ["swift run", "scripts/deploy_site.sh"]
}
```

### git

Markmesh の既存 Git 機能を extension から利用する。

```ts
const status = await api.git.status()
await api.git.commit({
  message: 'Add blog post: my-post',
  paths: ['Content/posts/my-post.md'],
})
await api.git.push()
```

`push` は破壊的ではないが外部副作用が大きいので、明示 confirmation を挟む。

## blog CMS extension manifest 案

```json
{
  "id": "tanabe1478.blog",
  "name": "Tanabe Blog Publisher",
  "version": "0.1.0",
  "main": "dist/index.js",
  "capabilities": {
    "commands": true,
    "workspace": {
      "read": ["Content/posts/**", ".markmesh/**"],
      "write": ["Content/posts/**"]
    },
    "editor": ["insertText", "imageDrop"],
    "secrets": ["gyazo.accessToken"],
    "network": [
      "https://upload.gyazo.com/*",
      "https://api.gyazo.com/*"
    ],
    "shell": ["swift run", "scripts/deploy_site.sh"],
    "git": ["status", "commit", "push"]
  }
}
```

## 実装順序

Markmesh 側では、次の順で小さく進めます。

1. `commands.registerCommand` の最小実装。
2. local extension manifest の読み込み。
3. workspace read API。
4. workspace write / create API。
5. editor insertText API。
6. secret storage API。
7. network capability API。
8. imageDrop hook。
9. shell task runner API。
10. git API。

blog extension 側では、次の順で小さく進めます。

1. extension skeleton。
2. `Blog: New Post`。
3. `Blog: Set Gyazo Token`。
4. `Blog: Upload Image to Gyazo`。
5. `Blog: Build`。
6. `Blog: Open Preview`。
7. `Blog: Commit`。
8. `Blog: Push`。

## open questions

- extension は vault 内 `.markmesh/extensions` から読み込むか、user global extension directory から読み込むか。
- secret key は extension id で namespace 分離するか。
- network permission は exact host match か glob か。
- shell command は string allowlist か structured command definition か。
- imageDrop hook は all images を extension に渡すか、extension が opt-in した vault だけにするか。
