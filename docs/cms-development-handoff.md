# Blog CMS development handoff

この文書は、別sessionの人またはAI agentがBlog CMSの開発を安全に引き継ぐための入口です。機能の概要だけでなく、Cloudflare Workers、Wrangler、Cloudflare Access、GitHub API、Gyazo、GitHub Actionsのつながりと、変更時の確認手順をまとめます。

実際の設定値は変わる可能性があるため、次を正本とします。

- Worker設定: `cms/wrangler.jsonc`
- npm commandと依存関係: `cms/package.json`
- CMS deploy: `.github/workflows/deploy-cms.yml`
- Blog deploy: `.github/workflows/deploy-blog.yml`
- 共通check: `.github/workflows/check.yml`
- Secretの値: CloudflareまたはGitHubのSecret storage（repositoryには置かない）

## 最初に読むもの

1. repository rootの`AGENTS.md`
2. この文書
3. `cms/README.md`
4. 変更対象の`cms/src/*.ts`と対応する`cms/tests/*.test.ts`
5. 公開処理にも触れる場合は`docs/deploy.md`

作業開始時は必ず既存差分を確認します。

```bash
git status --short --branch
```

未commit差分がある場合は、内容を確認せずに戻したり、自分の変更へ混ぜたりしません。

## 現在の全体構成

```text
Browser
  │
  │ Cloudflare Access login
  ▼
Cloudflare Worker: tanabe-blog-cms-api
  ├─ Access JWTをWorker内でも検証
  ├─ GitHub GraphQL APIから記事一覧を取得
  ├─ GitHub Contents APIから記事を取得・更新
  └─ Gyazo APIへ画像をupload
           │
           ▼
tanabe1478/blog main
  └─ Content/posts/*.mdが記事の正本
           │ Content等の変更でGitHub Actions起動
           ▼
Swift Publish build
  └─ Output/をrsync --delete
           ▼
tanabe1478/tanabe1478.github.io master
  └─ GitHub Pagesで公開
```

公開先:

```text
CMS:  https://tanabe-blog-cms-api.enterprise2580.workers.dev/
Blog: https://tanabe1478.github.io/
```

重要な境界:

- 記事の正本はD1ではなく`tanabe1478/blog`の`Content/posts/*.md`。
- 画像の新規保存先はGyazo。
- CMSのWorker deployとBlogの静的site deployは別workflow。
- CMSが記事を保存するとGitHubへcommitされ、その`Content/**`変更がBlog deployを起動する。
- `yurubo`とはCloudflare Account、Worker、API token、Secret、binding、D1、KV、R2を共有しない。

## Directoryとファイルの役割

| Path | 役割 |
| --- | --- |
| `cms/src/index.ts` | Workerのrouter、認証適用、HTTP response、write request制限 |
| `cms/src/access.ts` | Cloudflare Access JWTの署名・issuer・audience・email検証 |
| `cms/src/github.ts` | GitHub GraphQL/Contents API、metadata解析、SHA競合制御 |
| `cms/src/gyazo.ts` | 画像signature/size検証とGyazo upload |
| `cms/src/page.ts` | CMSのHTML、CSS、browser側JavaScript、live preview |
| `cms/tests/access.test.ts` | Access JWT検証のunit test |
| `cms/tests/index.test.ts` | route、GitHub/Gyazo連携、HTML script構文等のtest |
| `cms/wrangler.jsonc` | Worker名、Account、entry point、通常変数 |
| `cms/README.md` | 機能別の短い運用説明 |

`page.ts`は現在、HTML全体をtemplate literalとして持ちます。inline script内の正規表現やbackslashを編集すると、TypeScript側のtemplate literalでescapeが消える可能性があります。`npm run check`のscript構文testを必ず通してください。

## Wranglerとは何か

WranglerはCloudflare Workersのlocal開発、設定検証、Secret登録、deploy、log確認を行うCLIです。このrepositoryではglobal installに依存せず、`cms`のdevDependencyを使います。

```bash
cd cms
npm ci
npx wrangler --version
```

通常は直接commandを組み立てるより、`cms/package.json`のscriptを使います。

```bash
npm run dev
npm run check
npm run deploy
```

### `wrangler.jsonc`で管理するもの

- Worker名
- ブログCMS専用Cloudflare Account ID
- entry point (`src/index.ts`)
- compatibility date
- `workers.dev`の利用有無
- Secretではない環境変数

現在の通常変数:

| 変数 | 用途 |
| --- | --- |
| `TEAM_DOMAIN` | Access JWT issuerとJWKS取得元 |
| `POLICY_AUD` | Production/Preview Access Applicationの許可Audience。カンマ区切り |
| `WRITE_HOST` | GitHub保存とGyazo uploadを許可するProduction hostname |

Account IDとAudienceはcredentialそのものではありませんが、重複記載による設定ずれを避けるため`cms/wrangler.jsonc`を正本にします。`account_id`を変更すると別Accountへdeployし得るため、明示的な指示なしに変更しません。

### Wranglerの認証

localからCloudflareを操作する場合:

```bash
cd cms
npx wrangler login
npx wrangler whoami
```

`whoami`でブログCMS専用Accountを確認してから、Secret変更やmanual deployを行います。`yurubo`側Accountが選ばれている場合は作業を止めます。

CIではbrowser loginを使わず、GitHub Actions Secret `CLOUDFLARE_API_TOKEN`が環境変数としてWranglerへ渡されます。

### Local development

```bash
cd cms
npm ci
npm run dev
```

既定URL:

```text
http://127.0.0.1:8787/
http://127.0.0.1:8787/api/health
```

portを変える例:

```bash
npm run dev -- --port 8788
```

`npm run dev`はlocal Wranglerへだけ次を渡します。

```text
ACCESS_BYPASS=true
WRITE_HOST=127.0.0.1
```

これによりlocalではCloudflare Accessを迂回できます。`ACCESS_BYPASS`を`wrangler.jsonc`やProductionへ設定してはいけません。

Production Secretをlocalへコピーしないのが基本です。`cms/.dev.vars`はgitignoreされていますが、そこへ`GITHUB_TOKEN`を置くとlocal CMSから本物のrepositoryへ書き込めます。`GYAZO_ACCESS_TOKEN`を置くと実画像が即時uploadされます。通常の開発ではmock testを使い、実副作用が必要な確認だけ明示的に行います。

GITHUB tokenがないlocal環境では記事一覧がpublic Contents APIへfallbackするため、title/dateではなくfilename中心の表示になります。記事detailはpublic repositoryから確認できます。

```text
http://127.0.0.1:8787/?post=対象ファイル.md
```

### Secret操作

Production Worker Secret名:

```text
GITHUB_TOKEN
GYAZO_ACCESS_TOKEN
```

一覧確認（値は表示されない）:

```bash
cd cms
npx wrangler secret list
```

更新:

```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put GYAZO_ACCESS_TOKEN
```

入力値をcommand line argument、chat、log、repository fileへ書きません。Secret更新もProductionへ影響する操作なので、先に`npx wrangler whoami`を確認します。

### Deploy

通常は`main`へのpushとGitHub Actionsによる自動deployを使います。local manual deployは緊急時または明示的な確認時だけです。

```bash
cd cms
npm run check
npm run deploy
```

`npm run deploy`は`wrangler.jsonc`のWorkerへ直接反映します。manual deploy前には、差分、test、Accountを確認します。

### Production log

Worker内の`console.error`を調べる場合:

```bash
cd cms
npx wrangler tail
```

別terminalまたはbrowserから対象操作を再現します。request body、Access JWT、GitHub token、Gyazo tokenを追加でlog出力しないでください。利用中のWranglerでcommandが変わった場合は次を正本にします。

```bash
npx wrangler tail --help
npx wrangler --help
```

## Authenticationと書き込み防御

### Cloudflare Access

CMSのProductionとPreviewはCloudflare Access Applicationで保護されています。さらにWorkerの`authenticateAccess()`が`Cf-Access-Jwt-Assertion`を検証します。

検証内容:

1. JWT headerが存在する。
2. `TEAM_DOMAIN`がHTTPS URLである。
3. Team domainの`/cdn-cgi/access/certs`からJWKSを取得して署名検証する。
4. issuerがTeam domainと一致する。
5. audienceが`POLICY_AUD`のいずれかと一致する。
6. payloadに空でない`email`がある。

Access dashboard側だけ、またはWorker側だけを無効化しません。両方を使うのが現在のdefense in depthです。

### Productionだけが書き込める理由

`PUT /api/posts/:name`と`POST /api/images`は、認証後も次を要求します。

- request URLのhostnameが`WRITE_HOST`と一致
- `Origin` headerがrequest URLのoriginと完全一致

したがってAccessで許可されたPreviewでも読み取りはできますが、保存と画像uploadは`403`になります。新しいcustom domainを追加する場合は、Access設定だけでなく`WRITE_HOST`とOrigin制御も設計し直します。

### Browserへ渡さないもの

- GitHub token
- Gyazo token
- Cloudflare API token
- Access JWTの手動copy

GitHub/Gyazo APIは常にWorkerから呼びます。

## Secretとtokenの分離

| 名前 | 保存場所 | 最小scope / 用途 |
| --- | --- | --- |
| `GITHUB_TOKEN` | Cloudflare Worker Secret | `tanabe1478/blog`だけのContents read/write。記事一覧GraphQL、detail取得、保存 |
| `GYAZO_ACCESS_TOKEN` | Cloudflare Worker Secret | CMSからの画像upload |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions Secret | ブログCMS専用Cloudflare AccountのWorker deployだけ |
| `BLOG_DEPLOY_TOKEN` | GitHub Actions Secret | `tanabe1478/tanabe1478.github.io`だけのContents read/write |

GitHub tokenを1個にまとめません。特にCMSの記事更新tokenと公開site deploy tokenは別です。tokenの期限切れやrotation時も、同じ名前のSecretを保存先で更新し、値をcommitしません。

## API一覧

すべてのendpointはProductionではAccess認証後に処理されます。

| Method / Path | 用途 | 主な制限 |
| --- | --- | --- |
| `GET /` | CMS HTML | CSP、no-store |
| `GET /api/health` | Worker health | Accessの内側 |
| `GET /api/deployments/:commitSha` | Deploy Blog status | 40桁SHA検証、GitHub Actions API |
| `GET /api/posts` | 記事一覧 | GitHub GraphQL。`index.md`除外、date降順 |
| `POST /api/posts` | 新規記事作成 | Production Origin、厳格なslug、同名上書き禁止 |
| `GET /api/posts/:name` | Markdown detail | filename検証、最大1MB |
| `PUT /api/posts/:name` | 既存記事保存 | Production Origin、token、SHA必須 |
| `PATCH /api/posts/:name` | slug変更 | Production Origin、SHA、filename確認、atomic commit |
| `DELETE /api/posts/:name` | 既存記事削除 | Production Origin、SHA、filename確認、`index.md`禁止 |
| `POST /api/images` | Gyazo upload | Production Origin、signature検証、10MB以下 |

記事名は`Content/posts`直下の`.md`だけを許可し、slash、backslash、dot始まり等を拒否します。

## GitHub記事処理

### 一覧

ProductionではGitHub GraphQLを1 request使い、`Content/posts` tree内のBlob textから次を解析します。

- frontmatterの`date`
- 最初のMarkdown headingを`title`として使用
- `index.md`を除外
- date降順

これは公開blog topの43記事と同じ選択・順序になることを実データで確認済みです。記事にdateまたはheadingがない場合、現在の一覧parserはその記事を表示しません。

### 新規作成

一覧のフォームからslug、title、公開日時、description、tagsを入力し、browser内で未保存Markdownを生成します。本文を編集して保存した時点で、GitHub Contents APIへSHAなしのPUTを送りfileを初めて作ります。雛形だけを先にcommitしないため、空記事の自動deployを避けられます。

新規slugは英小文字・数字・単一hyphenだけを許可し、`index`を予約名として拒否します。GitHubが同名fileに`422`または競合を返した場合は`409`へ変換し、上書きしません。

### Detailと保存

Detail取得はGitHub Contents APIを使い、Base64をUTF-8へdecodeします。既存記事の保存時は取得時のBlob SHAを送ります。

- 最新SHAならGitHubの`main`へcommit
- 他の場所で更新されSHAが古ければ`409 Conflict`
- clientは勝手に上書きせず、再読み込みを促す

CMSの保存commit messageは`post: update <filename> via CMS`です。

### Slug変更

新slugと現在filenameの完全入力後、GitHub GraphQL `createCommitOnBranch`で新path追加・旧path削除を1つのatomic commitとして実行します。preflightでmain HEAD、old Blob SHA、新path不存在を確認し、mutationにも`expectedHeadOid`を渡します。

main更新、old SHA変更、新slug既存は`409`として旧記事を維持します。成功時はGit blob規則で新Blob SHAをWorker側計算し、rename直後の編集・削除でも競合検知を継続します。Previewは`403`、`index`は新旧とも禁止です。

旧公開URLからのredirectは自動作成しない方針です。UIで外部linkが切れることを明示し、成功後は新GitHub/public URLへ切り替えてrename commitのdeployを追跡します。

### 記事削除

既存記事detailでfilenameを完全入力した場合だけ、現在のBlob SHA付きでGitHub Contents DELETEを実行します。Production Originだけを許可し、Previewは`403`、`index.md`は`400`です。SHAが古ければ`409`として記事を残します。

削除成功後は削除commitのDeploy Blogを追跡し、公開サイトからの削除反映を表示します。Gyazo画像は記事から参照されなくなっても自動削除しません。local draftがある間は復元/破棄を選ぶまで削除操作を無効化します。

### 保存から公開まで

1. CMSが`tanabe1478/blog`の`main`へ記事commitを作る。
2. `.github/workflows/deploy-blog.yml`が`Content/**`変更で起動する。
3. macOS runnerでscript testとSwift Publish buildを行う。
4. `Output/`を公開repositoryへ`rsync --delete`する。
5. `tanabe1478/tanabe1478.github.io/master`へcommit/pushする。
6. public smoke checkをretryする。

CMSは保存responseのsource commit SHAで`deploy-blog.yml`のworkflow runを検索し、保存済み・build待ち、実行中、公開済み、失敗を表示します。10秒間隔で最大約5分pollingし、完了/失敗時に停止します。手動再確認とActions詳細linkも提供します。

`Deploy Blog`はpublic smoke check成功までworkflow内で確認するため、workflowの`completed/success`を公開済みとして扱います。GitHub Actions API errorやrate limitはstatus取得失敗として表示し、成功済みの記事保存を取り消しません。public repositoryのworkflowを最初は既存`GITHUB_TOKEN`で読み、Actions read権限がなく`401/403`の場合だけ認証なしでfallbackします。新しいSecret/scopeは追加していません。

## Gyazo画像処理

- browserは`multipart/form-data`でWorkerへ送る。
- WorkerはPNG、JPEG、GIF、WebPのfile signatureを確認する。
- 上限は10MB。
- WorkerがGyazoへtoken付きでuploadする。
- responseの画像URLとpermalinkからlinked-image Markdownを作る。
- file pickerまたはtextareaへのdrop位置へMarkdownを挿入する。

uploadは選択/drop直後に外部副作用を発生させます。記事編集をキャンセルしてもGyazo画像は削除されません。E2E確認では不要な実uploadを避けます。

## Local draft

編集中のMarkdownは400ms debounceでbrowserの`localStorage`へ保存します。keyはversion、`location.host`、記事名を含み、Production/Previewと記事間で混同しません。保存内容は本文、記事名、新規/既存、保存日時、既存記事ではbase SHAです。token、JWT、cookieは保存しません。

reload時はdraftを勝手に適用せず、GitHub版または未保存記事の復元画面で**下書きを復元**と**下書きを破棄**を選択します。base SHAと最新GitHub SHAが異なる場合はwarningを表示し、復元後もbase SHAを使うことで既存の`409`競合検知を維持します。

GitHub保存成功または確認付きcancelでdraftを削除します。`localStorage`はAccess logout後も端末に残るため、共有端末では必ず破棄します。quotaやbrowser設定でstorageが使えない場合はeditorを止めず、退避warningを表示します。

## Live preview

記事detailの閲覧時はMarkdown textareaを隠し、描画済み記事を表示します。編集時は左Markdown・右Previewの2ペインになり、800px以下は縦1列です。閲覧表示と編集Previewは同じrendererを使います。

現在のrendererは`cms/src/page.ts`内の小さな安全指向parserで、DOM APIと`textContent`だけで要素を作ります。raw HTMLを`innerHTML`へ渡しません。

対応範囲:

- heading
- paragraph
- bold
- inline code / fenced code block
- unordered / ordered list
- blockquote
- link
- 通常画像、Gyazo形式のリンク付き画像

完全なCommonMark/Swift Publish rendererではないため、公開結果とのpixel-level一致を保証するPreviewではありません。複雑なnested list、table、Markdown extension等を追加する場合は、先にtestを追加し、sanitizeされていないHTMLを導入しないでください。

CSPは`cms/src/index.ts`で設定します。画像sourceを増やすために`script-src`や`default-src`を緩めないでください。

## Testと確認手順

### 自動check

```bash
cd cms
npm ci
npm run check
```

初回のE2E実行前にPlaywright Chromiumをinstallします。

```bash
npx playwright install chromium
```

`npm run check`は次を実行します。

```text
TypeScript: WorkerとE2E
Vitest: Worker route / integration test
Playwright: Chromium E2E
```

VitestはAccess認証、route、GitHub/Gyazo request、入力検証、競合、HTML内script構文等を確認します。Playwrightはlocal Wranglerで実際のCMS HTML/JavaScriptを配信し、browserからの`/api/*`をmockしてclick、入力、navigation、成功・競合・失敗表示を確認します。どちらも実repositoryやGyazoへ副作用を起こしません。

### Browser E2E

user-facing機能は関連するPlaywright E2Eを必須にします。全taskのDefinition of Doneは`cms-roadmap.md`を正本とします。

設定とtest:

```text
cms/playwright.config.ts
cms/e2e/*.spec.ts
```

失敗時は`cms/test-results/`へtrace/screenshot、CIでは`playwright-report/`と合わせてartifactを保存します。token、cookie、Access JWT、browser auth stateは保存しません。

### 変更種別ごとの最低確認

| 変更 | 確認 |
| --- | --- |
| `access.ts` | issuer/audience/email/署名失敗test |
| `github.ts` | request URL/header/body、metadata、SHA、error mapping |
| `gyazo.ts` | MIMEだけでなくsignature、size、response検証 |
| `index.ts` | method/path/status、Origin/host、security header |
| `page.ts` | 関連Playwright E2E、必要に応じてagent-browser目視確認 |
| workflow/config | YAML/JSONC差分、scope、trigger path、CI run |

### Agent-browserでCMSを確認する例

1. local Workerを起動する。
2. detail URLを直接開く。
3. 編集ボタンを押す。
4. textarea入力、2ペイン、画像、キャンセルを確認する。
5. GitHub保存とGyazo uploadは、実副作用を意図した場合だけ行う。

確認観点:

- Desktopで2列、mobile幅で1列
- raw HTMLが実行されず文字として見える
- linkが`http`/`https`以外を許可しない
- 画像がcontainer幅を超えない
- cancelでoriginal contentへ戻る
- 保存buttonの連打を防ぐ

## GitHub Actions

### `Check`

`main` pushとpull requestでBlog checkとCMS checkを実行します。

### `Deploy CMS`

trigger:

- `main`へのpush
- `cms/**`またはworkflow file変更
- manual `workflow_dispatch`

処理:

1. `npm ci`
2. `npm run check`
3. `CLOUDFLARE_API_TOKEN`存在確認
4. `npm run deploy`

concurrencyは`deploy-cms-production`で、進行中deployを途中cancelしません。

### `Deploy Blog`

`Content/**`、`Resources/**`、`Sources/**`、Package、関連script等の変更で起動します。CMS sourceだけの変更では起動しません。CMSが記事を保存したcommitは`Content/**`変更なので起動します。

run確認例:

```bash
gh run list --repo tanabe1478/blog --limit 10
gh run view RUN_ID --repo tanabe1478/blog
```

## よくある問題

### Productionを開くとAccess loginになる

正常です。Production health endpointもAccessの内側です。Access policyを迂回するためにpublic health endpointを追加しません。

### JSON `403 Forbidden`

候補:

- Access JWT headerがWorkerへ届いていない
- issuer/audience/email検証失敗
- Previewからwriteしようとした
- hostnameが`WRITE_HOST`と違う
- `Origin`がrequest originと違う

Cloudflareのlogin pageによる拒否と、WorkerのJSON 403を区別します。

### 記事一覧が`502`

候補:

- `GITHUB_TOKEN`期限切れまたは権限不足
- GitHub GraphQL API error/rate limit
- GraphQL response shape変更

`npx wrangler tail`でstatusを確認します。token値やAuthorization headerは出力しません。

### 保存が`409`

表示後にGitHub側の記事が更新されています。現在内容を退避した上で再読み込みし、差分をmergeします。SHAチェックを外して強制上書きしません。

### 保存または画像uploadが`503`

対応するWorker Secretが設定されていません。

```bash
npx wrangler secret list
```

### 画像uploadが`400`または`413`

file signature不一致、未対応形式、または10MB超過です。Content-Type headerだけを信頼する実装へ弱めません。

### 画像uploadが`502`

Gyazo token、Gyazo API response、network errorを確認します。upload済みだがresponse処理だけ失敗した可能性もあるため、同じ画像を何度も再送する前にGyazo側を確認します。

### CMS deployは成功したが画面が古い

CMS HTML/APIは`Cache-Control: no-store`です。最新commitの`Deploy CMS` runとWorker名を確認します。Accessを通った別hostnameやPreviewを見ていないかも確認します。

### 記事保存は成功したがBlogが古い

`Deploy Blog` runを確認します。build、public repository push、GitHub Pages反映、smoke checkのどこで止まったかを分けて調べます。

## 安全な変更手順

1. `git status --short --branch`で既存差分を確認する。
2. 変更するfileの役割と理由を説明する。
3. 先に関連testを読む。bug fixでは可能ならtestを追加する。
4. 小さく変更する。
5. `cd cms && npm run check`を実行する。
6. UI変更はagent-browserで確認する。
7. `git diff --check`とsecret pattern scanを行う。
8. 差分を説明し、理解可能な単位でcommitする。
9. `main`へpushした場合は`Check`と`Deploy CMS`を確認する。
10. working treeがcleanか確認する。

禁止・注意:

- `git commit --no-verify`を使わない。
- 既存の未commit変更を戻さない。
- token、cookie、JWT、`.dev.vars`、browser stateをcommitしない。
- Productionで`ACCESS_BYPASS`を有効にしない。
- Previewをwrite可能にしない。
- GitHubのSHA競合制御を外さない。
- `yurubo`のAccount/token/resourceを使わない。
- UI確認のためだけに実Gyazo uploadや記事保存をしない。

## Rollbackの考え方

codeの問題は、原因commitを確認して通常の`git revert`を作り、`main`へpushして自動deployするのを基本にします。他人の変更を含む履歴をreset/force-pushしません。

Secretの問題はcode rollbackでは戻りません。Secret storage側で正しい値へrotationします。Cloudflare dashboardからdeploymentを操作する場合も、対象AccountとWorker名を二重確認します。

## 現在できること

- Accessで保護された記事一覧・描画済みdetail表示
- 公開blogと同じ43記事、title/date、date降順の一覧
- validated slug/frontmatterによる新規記事作成
- localStorage自動下書き、reload復元、SHA変更warning
- 保存commitを基準にしたbuild待ち / 実行中 / 公開済み / 失敗status
- atomic commit、filename確認、SHA/HEAD競合検知付きslug変更
- filename確認とSHA競合検知付きの記事削除
- 既存記事のMarkdown編集
- SHAによる競合検知付きGitHub保存
- 各記事detailからGitHub sourceと公開ページへのlink
- file picker / drag-and-dropによるGyazo upload
- cursor位置へのlinked-image Markdown挿入
- 編集時の2ペインlive preview
- 保存commitを起点にしたBlog自動build/deploy

## 次の実装task

優先順と完了条件は`cms-roadmap.md`を正本とします。

1. CMS-005: 記事一覧の検索・絞り込み
2. CMS-006以降をroadmap順に実装

各user-facing taskは関連するPlaywright E2EがlocalとCIで成功するまで`done`にしません。

## 文書を更新するタイミング

次を変更した場合、この文書も同じ作業または関連docs更新で見直します。

- Cloudflare Account、Worker名、custom domain
- Access Application/Audience
- Secret名またはtoken scope
- API endpoint、write制限
- GitHub repository/branch
- Blog deploy経路
- Wrangler commandやlocal開発方法
- CMSでできること、既知の制限
