# Gyazo authentication notes

Gyazo API の認証まわりの調査メモです。

参照:

- https://gyazo.com/api/docs
- https://gyazo.com/api/docs/auth?lang=ja

## 開発者自身で使う場合

Gyazo の developer page で発行した application access token をそのまま使えます。

画像 upload は次の形式です。

```http
POST https://upload.gyazo.com/api/upload
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: multipart/form-data

imagedata=<file>
```

この用途では、`client_id` / `client_secret` を使って access token を再発行する必要はありません。

## OAuth が必要な場合

任意のユーザーがそれぞれの Gyazo account に upload する一般向け extension にする場合は OAuth flow が必要です。

### 1. authorize

```text
GET https://gyazo.com/oauth/authorize
```

parameters:

```text
client_id
redirect_uri
response_type=code
state
```

ユーザーが許可すると、`redirect_uri` に `code` が付いて戻ります。

```text
http://localhost:4173/gyazo/callback?code=...
```

### 2. token exchange

```text
POST https://gyazo.com/oauth/token
```

parameters:

```text
client_id
client_secret
redirect_uri
code
grant_type=authorization_code
```

response:

```json
{
  "access_token": "...",
  "token_type": "bearer",
  "scope": "public"
}
```

## refresh token について

Gyazo docs には refresh token の記載は見当たりません。

また、access token について次の説明があります。

```text
access_token の有効期限はありません。
ユーザーがアプリケーションとの連携を解除するか、アプリケーションを削除するまで有効です。
```

そのため、一般的な OAuth のような refresh token 更新処理は不要です。

## 今回の方針

### 暫定 script

`scripts/upload_image_to_gyazo.py` は `GYAZO_ACCESS_TOKEN` を使います。

- `client_id` は使わない。
- `client_secret` は使わない。
- token 再発行もしない。

### 将来の Markmesh extension

初期実装は手動 token 登録で十分です。

```text
Blog: Set Gyazo Token
```

将来、他ユーザー向けに OAuth を組み込む場合は、Markmesh 側で次を実装します。

- local callback server または custom URL scheme
- `state` による CSRF 対策
- `/oauth/token` で code を access token に交換
- access token を Markmesh secret storage に保存

Callback URL は当面これでよいです。

```text
http://localhost:4173/gyazo/callback
```
