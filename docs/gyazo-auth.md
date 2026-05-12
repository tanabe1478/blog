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

OAuth flow を試すための補助 script も用意しています。

認可 URL を作る:

```bash
scripts/gyazo_authorize_url.py
```

callback を local server で受け取る:

```bash
scripts/gyazo_oauth_callback_server.py --state STATE_FROM_AUTHORIZE_URL
```

callback で受け取った code を access token に交換する:

```bash
scripts/exchange_gyazo_oauth_code.py CODE_FROM_CALLBACK
```

callback server で受信と token exchange をまとめて試す場合:

```bash
scripts/gyazo_oauth_callback_server.py --state STATE_FROM_AUTHORIZE_URL --exchange
```

これらの script は `.env` から次を読みます。

```text
GYAZO_CLIENT_ID
GYAZO_CLIENT_SECRET
GYAZO_CALLBACK_URL
```

結果の `access_token` は表示するだけで保存しません。

### 将来の OAuth 組み込み

初期実装は `.env` または shell の環境変数での手動 token 登録で十分です。

将来、他ユーザー向けに OAuth を組み込む場合は、editor ではなく script / CLI 側の補助 workflow として検討します。

- local callback server または custom URL scheme
- `state` による CSRF 対策
- `/oauth/token` で code を access token に交換
- access token を repository 外の secret store または ignored `.env` に保存

Callback URL は当面これでよいです。

```text
http://localhost:4173/gyazo/callback
```
