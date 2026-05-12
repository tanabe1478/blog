# Script-based publish workflow

この blog の執筆・公開 workflow は Markmesh に依存させません。

Markmesh は Markdown editor / previewer の一候補として使えますが、記事作成、画像 upload、build、deploy の正本は repository 内の script に置きます。

## 基本方針

普段の公開作業は 1 コマンドに集約します。

```bash
scripts/publish_blog.py
```

この script が次をまとめて行います。

1. `Content/posts/*.md` を走査する。
2. local image を Gyazo に upload する。
3. Markdown の画像 URL を Gyazo URL に置換する。
4. `swift run` で記事一覧、feed、sitemap、`Output/` 全体を再生成する。
5. `scripts/check_output_site.py` で生成結果を確認する。
6. source repository の変更を commit / push する。
7. `Output/` 全体を `tanabe1478/tanabe1478.github.io` に deploy する。
8. 公開後 smoke check を実行する。

画像置換対象だけ確認する場合:

```bash
scripts/publish_blog.py --dry-run
```

commit message を変える場合:

```bash
scripts/publish_blog.py --message "post: add recent notes"
```

## Markmesh に依存させない理由

- 公開処理は現在開いている note ではなく、`Content/posts/` 全体を対象にする必要がある。
- 記事一覧、feed、sitemap は `swift run` で site 全体を再生成して初めて更新される。
- 画像 upload も active file / active image ではなく、Markdown 全体の local image を検出して処理したい。
- terminal や CI から同じ workflow を再実行できる方が安全。
- 将来 editor を変えても publish workflow を維持できる。

## 主な script

### 新規記事

```bash
scripts/new_post.py "記事タイトル" --slug article-slug
```

生成先:

```text
Content/posts/article-slug.md
```

### publish

```bash
scripts/publish_blog.py
```

普段はこれだけを使います。

### low-level script

個別に確認したい場合だけ、下位 script を直接使います。

```bash
scripts/prepare_for_deploy.py --dry-run --skip-build
scripts/prepare_for_deploy.py
scripts/deploy_site.sh --check
```

## 画像

新規画像は Gyazo を前提にします。

執筆中は Markdown で local image を参照してよいです。

```markdown
![desk](attachments/desk.png)
![desk](.markmesh/blog-assets/desk.png)
```

`publish_blog.py` 実行時に Gyazo URL へ置換されます。

既存の public URL は置換対象外です。

```markdown
![already gyazo](https://i.gyazo.com/example.png)
![github image](https://user-images.githubusercontent.com/example.png)
![blog asset](/images/example.png)
```

## Markmesh との関係

Markmesh 側の extension / plugin manifest は、この repository からは撤退します。

必要になった場合でも、Markmesh は script を呼び出す任意の UI として扱い、blog workflow の必須依存にはしません。
