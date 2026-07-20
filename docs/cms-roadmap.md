# Blog CMS roadmap

この文書は、Blog CMSで今後実装する機能の正式なbacklogです。別sessionでも優先順と完了条件を維持するため、task IDを変更せずに状態を更新します。

## 状態

| 状態 | 意味 |
| --- | --- |
| `planned` | 実装予定。まだ着手していない |
| `in-progress` | 現在作業中 |
| `blocked` | 先に判断または別taskが必要 |
| `done` | test、document、必要なdeploy確認まで完了 |

状態を`done`にするときは、実装commitと確認内容をtaskへ追記します。複数のtaskを一度に実装せず、原則としてtask ID単位で小さく進めます。

## 優先順

```text
Milestone 0: 自動E2Eでbrowser動作を担保する
Milestone A: 執筆中のデータを失わない
Milestone B: 保存後の公開状態が分かる
Milestone C: 記事のlifecycleをCMSで完結する
Milestone D: 記事を探し、編集し、戻せる
Milestone E: Markdownと画像編集を改善する
Milestone F: 公開管理を拡張する
Milestone G: 運用・監査を改善する
```

## Task一覧

| ID | Task | Milestone | 状態 |
| --- | --- | --- | --- |
| CMS-000 | Playwright E2E基盤 | 0 | `done` |
| CMS-001 | localStorage自動下書きと復元 | A | `done` |
| CMS-002 | GitHub Actions / 公開status表示 | B | `done` |
| CMS-003 | 記事削除 | C | `done` |
| CMS-004 | slug変更（rename） | C | `done` |
| CMS-005 | 記事一覧の検索・絞り込み | D | `planned` |
| CMS-006 | metadata専用編集form | D | `planned` |
| CMS-007 | 保存前の差分表示 | D | `planned` |
| CMS-008 | GitHub履歴表示と以前の版への復元 | D | `planned` |
| CMS-009 | Markdown toolbar | E | `planned` |
| CMS-010 | 画像alt text編集 | E | `planned` |
| CMS-011 | Preview互換性の改善 | E | `planned` |
| CMS-012 | Gyazo orphan画像の管理 | E | `planned` |
| CMS-013 | 公開予約 | F | `planned` |
| CMS-014 | tag管理 | F | `planned` |
| CMS-015 | 複数端末で共有できるprivate draft | F | `planned` |
| CMS-016 | Access利用者の監査情報 | G | `planned` |
| CMS-017 | token期限・rotation状態の確認 | G | `planned` |
| CMS-018 | Production新規作成E2E確認手順 | G | `planned` |

---

## E2E方針とDefinition of Done

ここからのuser-facing機能は、Vitestだけで完了扱いにせず、関連するPlaywright E2Eを必須にします。

E2Eの責務:

- local Wranglerから実際のCMS HTML/JavaScriptを配信する。
- Chromiumでclick、入力、navigation、reload、表示状態を確認する。
- browserからの`/api/*` requestをPlaywrightでmockし、成功・競合・失敗を再現する。
- Production GitHub、Gyazo、Cloudflare resourceへwriteしない。
- screenshot比較は必須にせず、失敗時のtrace/screenshotをartifactとして利用する。

Vitestの責務:

- Worker route、Access、Origin/host制限、validation、GitHub/Gyazo request形式を検証する。
- 外部APIをmockし、HTTP statusとerror mappingを高速に確認する。

各taskのDefinition of Done:

1. TypeScript checkが成功する。
2. Vitestが成功する。
3. 変更したuser flowのPlaywright E2Eが追加され、localとCIで成功する。
4. security-sensitiveな失敗caseはVitestまたはE2Eの適切な側へ追加する。
5. UI変更は必要に応じてagent-browserでも目視確認する。
6. document、CI、deploy確認まで完了する。

E2Eへtoken、cookie、Access JWT、browser認証stateを保存しません。Productionに対する破壊的E2Eは通常CIへ入れず、CMS-018の明示的な手順で扱います。

## Milestone 0: 自動E2Eでbrowser動作を担保する

### CMS-000 Playwright E2E基盤

状態: `done`

実装:

- `cms/playwright.config.ts`
- `cms/e2e/cms.spec.ts`
- `npm run check`でTypeScript、Vitest、Playwrightを実行
- Check / Deploy CMS workflowでChromium E2Eを必須化
- 失敗時にtrace、screenshot、HTML reportをCI artifactへ保存
- APIはPlaywrightでmockし、実GitHub/Gyazoへのwriteなし

目的:

- 今後のCMS機能を実browser workflowで継続的に検証する。

完了条件:

- `@playwright/test`とChromiumを導入する。
- Playwrightがlocal Wranglerを自動起動・終了する。
- API responseをtest内でmockするfixture/helperを用意する。
- 記事一覧、描画済みdetail、編集2ペイン、cancelをE2E化する。
- 新規記事form、frontmatter生成、初回保存成功をE2E化する。
- 公開ページ/GitHub linkを確認する。
- save conflict/error時に入力内容が失われないことを確認する。
- GitHub Actionsの`Check`と`Deploy CMS`でE2Eを実行する。
- 失敗時のtrace/screenshotをCI artifactとして確認できる。
- E2Eが実GitHub保存・実Gyazo uploadを行わないことをdocument化する。

依存: なし。CMS-001より先に実装する。

---

## Milestone A: 執筆中のデータを失わない

### CMS-001 localStorage自動下書きと復元

状態: `done`

実装:

- 400ms debounceで記事別localStorage keyへ保存
- 既存記事と新規記事のreload復元 / 明示破棄
- 新規記事は`?draft=<name>`で未保存状態を再表示
- base SHA不一致warningと409競合維持
- GitHub保存成功 / 確認付きcancelでdraft削除
- storage unavailable時も編集継続
- Vitest 23件とPlaywright E2E 8件で確認

目的:

- browser tabの誤close、reload、network errorで未保存本文を失わない。
- 新規記事と既存記事編集の両方を保護する。

完了条件:

- textarea変更をdebounceして`localStorage`へ保存する。
- draft keyはProduction/Preview/記事slugを混同しない。
- 既存記事はGitHubから取得したSHAまたはbase contentとの関係を記録する。
- draftがある場合、勝手に上書きせず「復元」「破棄」を選べる。
- GitHub保存成功後は対応draftを削除する。
- 新規記事のcancel時は、draftを残すか破棄するか明示する。
- storage unavailable / quota exceededでもeditor自体は使える。
- Access logout後も端末に本文が残ることをUI/documentで説明する。
- VitestとPlaywright E2Eでreload復元を確認する。

注意:

- `localStorage`は暗号化storageではない。shared端末では記事本文が残る。
- token、Access JWT、cookieは絶対に保存しない。
- 最初は端末内draftだけとし、複数端末同期はCMS-015で別途設計する。

依存: なし

---

## Milestone B: 保存後の公開状態が分かる

### CMS-002 GitHub Actions / 公開status表示

状態: `done`

実装:

- 保存responseのsource commit SHAで`deploy-blog.yml` runを検索
- 保存済み/build待ち、実行中、公開済み、失敗の4状態
- 10秒間隔、最大30回でpollingを自動停止
- 手動再確認とGitHub Actions詳細link
- public smoke checkを含むworkflow successを公開済み判定に使用
- status API失敗時も記事保存成功と本文を維持
- Actions APIの401/403時だけpublic APIへ認証なしfallback
- 新しいSecret/token scope追加なし
- Vitest 29件とPlaywright E2E 11件で確認

目的:

- 「GitHubへ保存」後に、build中・公開済み・失敗をCMSから確認できるようにする。

完了条件:

- 保存時のsource commit SHAを基準にdeploy runを追跡する。
- 少なくとも`保存済み`、`build待ち/実行中`、`公開済み`、`失敗`を区別する。
- pollingを一定時間で停止し、手動再確認を提供する。
- GitHub API errorやrate limitを記事保存失敗として扱わない。
- 公開済み判定後に「公開ページを開く」を強調する。
- token scopeを増やす場合は既存`GITHUB_TOKEN`へ安易に権限追加せず、public APIまたはstatus専用tokenを比較する。

注意:

- source repositoryのworkflow成功とGitHub Pages配信完了には時間差がある。
- smoke check成功を公開済みの最終条件として利用できるか調査する。

依存: なし

---

## Milestone C: 記事のlifecycleをCMSで完結する

### CMS-003 記事削除

状態: `done`

実装:

- filename完全入力による削除確認
- Production Origin、token、現在Blob SHAをWorkerで検証
- `index.md`削除禁止、Preview削除禁止
- SHA競合時は409で記事を維持
- local draft解決前は削除buttonを無効化
- 削除commitのDeploy Blog statusを追跡
- Gyazo画像は自動削除しない
- Vitest 34件とPlaywright E2E 13件で確認

目的:

- GitHub画面を開かずに記事を削除できるようにする。

完了条件:

- Production Originだけで実行できる。
- 現在のBlob SHAを必須にする。
- filenameまたはslugの確認入力を要求する。
- `index.md`は削除できない。
- GitHub競合を`409`として扱い、強制削除しない。
- 削除commit後のBlog deploy状態を案内する。
- Gyazo画像は記事削除と同時に自動削除しない。

依存: CMS-002があると削除後の公開確認が分かりやすいが、必須ではない。

### CMS-004 slug変更（rename）

状態: `done`

実装:

- 新slugと現在filenameの完全入力
- Production Origin、現在Blob SHA、新path不存在、main HEADを検証
- GitHub GraphQL `createCommitOnBranch`によるatomic追加/削除
- `expectedHeadOid`でbranch更新競合を409化
- Git blob SHAをWorker側計算してrename後の競合制御を継続
- Previewと`index`を拒否
- 旧URLはredirectしない方針をUIで警告
- rename commitのDeploy Blog statusを追跡
- Vitest 39件とPlaywright E2E 15件で確認

目的:

- 記事filenameと公開URLのslugを変更できるようにする。

完了条件:

- 新slug追加と旧file削除をatomic commitにし、競合を検知する。
- 新slugは新規記事と同じvalidationを使う。
- 同名fileがある場合は拒否する。
- atomic commitにより途中の部分成功を発生させない。
- 旧公開URLをredirectするか、link切れを許容するかを実装前に決める。
- rename前に影響するURLを明示し、確認入力を要求する。

注意:

- GitHub Contents APIではなくGraphQL atomic commitを使う。
- redirectなしのslug変更は外部linkを壊す。

依存: CMS-003のdelete処理。redirect方針の判断。

---

## Milestone D: 記事を探し、編集し、戻せる

### CMS-005 記事一覧の検索・絞り込み

状態: `planned`

完了条件:

- title、filename、date、tagをclient側で検索できる。
- date昇順/降順を切り替えられる。
- 0件時と検索解除が分かりやすい。
- keyboardだけでも操作できる。

依存: tag検索には一覧APIでtagを返す変更が必要。

### CMS-006 metadata専用編集form

状態: `planned`

完了条件:

- title、date、description、tagsをMarkdown sourceから読み、formで編集できる。
- form変更をfrontmatterと最初の見出しへ安全に反映する。
- parseできない既存frontmatterを壊さず、source編集へfallbackできる。
- date/title欠落で記事一覧から消える事故を防ぐ。

依存: なし

### CMS-007 保存前の差分表示

状態: `planned`

完了条件:

- original Markdownと現在値の差分を保存前に確認できる。
- 追加・削除が識別できる。
- 大きな記事でもbrowserを固めない。
- diff表示にraw HTMLを挿入しない。

依存: なし

### CMS-008 GitHub履歴表示と以前の版への復元

状態: `planned`

完了条件:

- 対象fileのcommit履歴を表示する。
- 過去版をread-onlyで確認できる。
- 復元は過去版を新しいcommitとして保存し、履歴を書き換えない。
- 現在SHAとの競合を検知する。

依存: GitHub API scope/rate limitの確認。

---

## Milestone E: Markdownと画像編集を改善する

### CMS-009 Markdown toolbar

状態: `planned`

完了条件:

- heading、bold、link、list、code、image等の最低限の挿入操作を提供する。
- textarea selection/cursor位置を維持する。
- keyboard操作とaria-labelを提供する。
- toolbarなしでもMarkdownを直接編集できる。

依存: なし

### CMS-010 画像alt text編集

状態: `planned`

完了条件:

- upload前または挿入時にalt textを指定できる。
- 空altを意図する装飾画像と、未入力を区別する方針を決める。
- filenameだけを自動altにして完了扱いしない。

依存: CMS-009と同時にUIを整理してもよいが、commitは分ける。

### CMS-011 Preview互換性の改善

状態: `planned`

目的:

- CMS PreviewとSwift Publish公開結果の差を減らす。

完了条件:

- 現在未対応のnested list、table、Markdown extensionを調査する。
- 実記事のsyntax inventoryを作る。
- raw HTMLを実行しない安全性を維持する。
- sanitizerなしで`innerHTML`へMarkdownを渡さない。
- 完全一致できない項目をUI/documentで明示する。

依存: 実記事調査。

### CMS-012 Gyazo orphan画像の管理

状態: `planned`

目的:

- upload後に記事保存をcancelした画像を把握しやすくする。

完了条件:

- Gyazo APIが安全な削除または一覧取得を提供するか調査する。
- upload responseで削除に必要な情報がある場合も、browserへ危険なcredentialを渡さない。
- 自動削除、手動削除候補表示、現状維持を比較して方針を決める。
- 記事中で使用中の画像を誤削除しない。

依存: Gyazo API仕様の確認。調査結果により`blocked`になり得る。

---

## Milestone F: 公開管理を拡張する

### CMS-013 公開予約

状態: `planned`

完了条件:

- future dateを書くだけで即時公開される現在のbuild挙動を先に確認する。
- privateな予約本文の保存先を決める。
- 指定時刻にsourceへ反映しdeployする仕組みを設計する。
- timezoneを明示する。
- 予約解除・時刻変更・失敗時再実行を扱う。

注意:

- public repository内に予約前本文を置くと、siteに出なくても内容自体は公開される。

依存: CMS-015または別のprivate storage / private branch方針。

### CMS-014 tag管理

状態: `planned`

完了条件:

- 既存tag一覧と使用件数を表示する。
- 新規/metadata formから既存tagを選択できる。
- 表記揺れを検出する。
- tag削除が記事本文へ与える影響を明示する。

依存: CMS-006。

### CMS-015 複数端末で共有できるprivate draft

状態: `planned`

目的:

- localStorage draftを別端末でも安全に継続できるようにする。

完了条件:

- draftをpublic GitHub repositoryへ保存しない。
- Cloudflare KV/D1/R2、private GitHub branch/repository等を比較する。
- Access user単位、暗号化、容量、削除、backup、Free枠を検討する。
- source of truthを公開記事のGitHub Markdownから変更しない。
- conflict処理を定義する。

注意:

- 現時点ではD1等を不要としている。必要性と運用負荷を再評価してから導入する。

依存: CMS-001でlocal draft運用を確認してから判断。

---

## Milestone G: 運用・監査を改善する

### CMS-016 Access利用者の監査情報

状態: `planned`

完了条件:

- 誰がwrite操作をしたか確認する必要性を再評価する。
- public commit messageへemail等の個人情報を載せない。
- Cloudflare log、private audit storage、匿名化identifierを比較する。
- retentionと削除方針を決める。

注意:

- 現在は個人利用なので、複雑な監査基盤を追加しない選択肢もある。

依存: privacy方針。

### CMS-017 token期限・rotation状態の確認

状態: `planned`

完了条件:

- `GITHUB_TOKEN`、`GYAZO_ACCESS_TOKEN`、`CLOUDFLARE_API_TOKEN`、`BLOG_DEPLOY_TOKEN`の保存場所とscopeを確認するchecklistを作る。
- 値を取得・表示せず、期限や最終rotation日を安全に記録する方法を決める。
- 期限切れ時の症状と更新手順をdocument化する。
- tokenを1つへ統合しない。

依存: なし

### CMS-018 Production新規作成E2E確認手順

状態: `planned`

目的:

- 不要な記事を残さず、Productionの作成から公開までを確認できるようにする。

完了条件:

- test記事を作る場合のslug、内容、削除手順を定義する。
- Access、GitHub create commit、Deploy Blog、public URLを確認する。
- Gyazo uploadは別testとし、不要な画像を増やさない。
- CMS-003実装後はtest記事削除と公開site反映まで確認する。

依存: 安全なcleanupにはCMS-003が望ましい。

---

## 実装順の運用

原則としてTask一覧の上から進めます。ただし、次の場合は順番を変更できます。

- security bugやdata-loss bug
- 外部serviceの仕様変更
- 後続taskの調査で先行taskが必要になった
- ユーザーが明示的に優先度を変更した

順番を変更した場合は、この文書のTask一覧と各taskの依存関係を更新します。

## 完了済み機能

以下はbacklogではなく、現在利用できる機能です。

- Cloudflare AccessとWorker JWT検証
- 公開blogと揃えた記事一覧
- 描画済み記事detail
- 既存記事編集とSHA競合検知
- validated slug/frontmatterによる新規記事作成
- Gyazo画像uploadとdrag-and-drop
- 2ペインlive preview
- 記事detailからGitHub source / 公開ページへのlink
- GitHub保存後の自動Swift Publish build / GitHub Pages deploy

詳細な構成と開発手順は`cms-development-handoff.md`を参照してください。
