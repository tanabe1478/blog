# Post migration check

blog / diary 統合後に、公開サイトが最低限正しく見えるかを確認するためのメモです。

## 確認日

2026-05-11

## 確認対象

```text
https://tanabe1478.github.io/
https://tanabe1478.github.io/posts/diary-34/
https://tanabe1478.github.io/posts/20200110/
https://tanabe1478.github.io/diary/
https://tanabe1478.github.io/diary/articles/34
```

## 確認結果

### `/`

- `200 OK`
- 新 blog の HTML が返っている。
- 記事一覧が表示される。

### `/posts/diary-34/`

- `200 OK`
- diary から移行した記事が表示される。
- 旧 diary upload 由来の画像 2 件が `/images/uploads/...` で表示できる。

確認した画像:

```text
/images/uploads/c13ae456-dfee-48db-aa1d-f31d0009ab6e-cc7bd6fd6ca83ce607b965a9aba5b584.png
/images/uploads/2faf82ad-5995-4d7f-b6a8-dcd182e774a2-aa5aaffa68d720321e11131bd20a19c7-1.png
```

### `/posts/20200110/`

- `200 OK`
- 既存 blog 記事が表示される。
- 既存画像 3 件が `/images/20220110/...` で表示できる。

確認した画像:

```text
/images/20220110/20220108124700.png
/images/20220110/b666301e5c9f085f1bd3eb62e63a0c5d.jpg
/images/20220110/projector.jpg
```

### `/diary/`

- `200 OK`
- diary repository 側の redirect page が返っている。
- 新 blog root へ移動する。

### `/diary/articles/34`

- `200 OK`
- diary repository 側の redirect page が返っている。
- `/posts/diary-34/` へ移動する。

## 再確認用 script

公開後の HTTP response と記事内画像 URL は、次の script で再確認できます。

```bash
scripts/check_public_site.py
```

## 注意

この確認は HTTP response と画像 URL の存在確認です。見た目の最終確認は agent-browser で行います。
