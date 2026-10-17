# Image hosting

記事画像はこのrepositoryの`Resources/images/`に置き、GitHub Pagesから自サイトURL `/images/...` で配信します。外部画像hostingは使いません。

## 方針

- 新規画像は`Resources/images/<記事slug>/<sha256先頭16桁>.<拡張子>`に保存する。
- Markdownでは`![alt](/images/<記事slug>/<file>)`で参照する。
- filenameは内容hashなので、同じ画像を何度取り込んでも同じpathになり、名前の衝突もない。
- 拡張子はfilenameではなく画像signature（PNG / JPEG / GIF / WebP）から決める。
- 画像用のsecretは不要。CMSは既存の`GITHUB_TOKEN`でrepositoryへcommitする。
- 生成HTMLが参照するlocal assetの欠落は`scripts/check_output_site.py`が検出する。

旧diaryから保全した画像（`/images/uploads/...`）や、手で置いた既存画像（`/images/<topic>/...`）もそのまま有効です。

## 画像を追加する経路

### local / script

記事の近くに置いた下書き画像を参照します。

```markdown
![desk](attachments/desk.png)
```

`scripts/publish_blog.py`（内部で`scripts/prepare_for_deploy.py`）が`attachments/`と`.markmesh/blog-assets/`配下の画像を`Resources/images/<slug>/`へcopyし、Markdownを書き換えます。単体で実行する場合:

```bash
scripts/import_local_images.py Content/posts/example.md
scripts/import_local_images.py Content/posts/example.md --dry-run
```

copy元の`attachments/...`は削除しません。

### CMS

file pickerまたはdrag-and-dropで画像を選ぶと、Worker（`cms/src/images.ts`）がGitHub Contents APIで`Resources/images/<slug>/`へ即時commitし、Markdownを本文へ挿入します。

- 同じ内容の画像が既にある場合（GitHubの`422`）は上書きせず成功扱いにする。
- 画像commitは`Resources/**`の変更なのでDeploy Blogが走る。
- CMS previewは`/images/...`を`raw.githubusercontent.com`の`main`から表示する。upload直後でdeploy前でも確認できる。
- 記事を保存しなかった場合も画像commitは残る。不要なら手で削除する。

## Gyazoからの移行（2026-10）

Gyazoのincident対応で信用できなくなったため、外部画像hostingをやめてrepository配信へ移しました。

| 記事 | 状態 |
| --- | --- |
| `one-command-blog-publish-workflow.md` | 移行済み。元画像`Content/posts/attachments/blog-publish-workflow-home.png`から取り込み |
| `diary-15.md` | **未移行**。元画像が無く、移行作業時はi.gyazo.comが503でWayback Machineにも保存が無かった |
| `diary-2`〜`diary-12`の12枚 | 移行済み。旧diary Issueの`user-images.githubusercontent.com`画像もGitHub側の管理で外部依存のため、取得できるうちに取り込んだ |

`diary-15.md`は、画像を取得できるようになったら次の手順で移行します。

```bash
curl -fsSL -o /tmp/diary-15.jpg https://i.gyazo.com/6247216ff31664fbe5697119621a7a10.jpg
mkdir -p Content/posts/attachments && cp /tmp/diary-15.jpg Content/posts/attachments/diary-15.jpg
# 記事の ![](https://i.gyazo.com/...) を ![](attachments/diary-15.jpg) に書き換えてから
scripts/import_local_images.py Content/posts/diary-15.md
```

残っているGyazo参照は次で確認できます。

```bash
grep -rn 'gyazo\.com' Content
```

記事本文で当時のGyazo運用に触れている文章は記録として残しています。

`m.media-amazon.com`の商品画像は権利がAmazon側にあるため、repositoryへcopyせず外部参照のままにしています。

## Gyazoの後片付け（手作業）

repositoryの外にある設定は手で片付けます。

- Cloudflare WorkerのSecret `GYAZO_ACCESS_TOKEN`を削除する（2026-10-18 削除済み）
- GyazoのOAuth application / access tokenをGyazo側で無効化する
- localの`.env`に`GYAZO_*`が残っていれば削除する
- Gyazo上の画像を消すかは、全記事の移行が終わってから判断する
