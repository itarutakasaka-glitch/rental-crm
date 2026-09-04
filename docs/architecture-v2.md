# tama-fudosan-crm 全体設計図 v2.0

2026-08-30 作成。1週間の実装（PR#1〜#15）を総点検し、見つかった穴を織り込んで引き直した全体設計。
**アーキテクチャの正本はこのファイル**。機能別の経緯・詳細は [store-hierarchy-design.md](store-hierarchy-design.md)（歴史込みの設計ノート）を参照。

## 0. 総点検で見つかった穴（2026-08-30 時点）

実コードと突き合わせて確認済みのもののみ。「設計書に書いたのに実装されていない」パターンが多い。

### P0：セキュリティ・出荷済み機能のバグ・決定違反

| # | 穴 | 実害 |
|---|---|---|
| 1 | `sendMessage`/`recordInboundMessage`（server action）が**無認証** | 未ログインでも会社名義でメール/LINE/SMSを任意の顧客に送れる。API route 6件は修正済みだったが送信の本丸が抜けていた |
| 2 | Phase1「下書き承認・送信は人」決定（2026-08-26）が**未実装** | cron/agentは`autoReplyEnabled`も`autoReplyMode`も見ずに自動送信する。DRAFT_ONLYフラグは飾り |
| 3 | 全社ダッシュボードのリンク先が**404** | staffが/inboxで他社顧客をクリックすると`/customers/[id]`の`organizationId !== user.organizationId`チェックでnotFound。前日出荷した機能自体のバグ |

### P1：スキーマ・機能が「絵に描いた餅」

| # | 穴 | 実害 |
|---|---|---|
| 4 | 新カラム6つ（hasCustomerReplied/desireSignalDetectedAt/isBookingConfirmed/intentCategory/vacancyStatus/Customer.storeId）に**書き込むコードがゼロ** | DBに列があるだけ。特にhasCustomerRepliedは受信処理で立てるだけなのに未実装 |
| 5 | isStaff/StaffOrgAccessを**付与する手段が無い**（UI・API皆無） | 全社ダッシュボードは手SQLなしに誰も使えない。Itaruのユーザーもstaff未設定＝機能OFF状態 |
| 6 | StoreRoutingPanelの判定結果が**保存されない** | 推奨を出すだけでstoreIdにもタグにも書かない。CRM内ならワンクリック反映できるべき |
| 7 | **Organization.slugが無い** | Storeにだけslugを付けた片手落ち。反響メール宛先→会社ルーティングは設計自体が先送りのまま |

### P2：運用・保守

| # | 穴 |
|---|---|
| 8 | エラーのSlack通知ゼロ（ハウスルール違反：全システムのエラーは#900_dev_monitoringへBot名義通知）。cronは毎分動いているのに失敗しても誰も気づかない |
| 9 | マイグレーション機構が場当たり（`/api/agent/migrate`にSQL追記方式）。prisma migrate未導入、`neon-init.sql`は凍結スナップショットで今後ズレる |
| 10 | npm audit high 11件が初日から放置 |
| 11 | Neonのバックアップ/PITR未確認。**Supabase AuthはDB移行後も残存依存**（ログインはSupabase。プロジェクトを消すとログイン不能）——どこにも明文化されていなかった |
| 12 | テンプレート3重構造（Template/AgentTemplate/drafts.jsハードコード）未整理 |
| 13 | Neonデータ移行時、旧DBのドリフトカラム（Customer.currentAddress、Message.metadata、Workflow.triggerType等）のデータは**意図的に捨てた**。会話ログには残るが設計書に記録が無かった（→ここに記録） |

### P3：42社スケールへの未設計

| # | 穴 |
|---|---|
| 14 | ステータス体系が会社ごと自由 → 横断ダッシュボードで「未対応」を会社横断で数えられない。共通ステータス層（システム定義）または対応マップが必要 |
| 15 | 横断クエリのスケール：`take:200`の単純クエリは42社×数千件で破綻。「未対応最上位固定」ソート（競合CRM研究で採用を決めた）も未実装 |
| 16 | 二重対応防止ロック未実装（横断運用では重要度が上がる） |

## 1. システム構成（現状の実物）

```
[オペレーター/クライアント] ──ログイン──> Supabase Auth（認証のみ・残存依存）
        │
        v
Vercel: Next.js 15 App Router（tama-fudosan-crm-2026）
  ├─ 画面: /inbox（全社ダッシュボード） /customers /settings/* /agent/*
  ├─ API routes: /api/*（Supabaseセッション or CRON_SECRETで認証）
  ├─ server actions: sendMessage等（★P0-1：要認証化）
  └─ Vercel Cron: /api/cron/agent（毎分） /api/cron/workflow（毎時）
        │
        v
Neon Postgres（Prisma。2026-08-29にSupabase DBから移行済み・旧接続はバックアップ保持）
        │
外部: Resend（メール送受信・webhook） / LINE Messaging API / Twilio SMS
     / OpenAI（分類・下書き生成） / Browserless（スクレイピング）
```

- ローカル環境の制約：この開発環境からNeon/Supabaseに直接DB接続できない（ハング）。**DBを触る操作はすべて本番APIエンドポイント経由**（`/api/agent/migrate*`パターン）で行うのが確立した手順。

## 2. テナントモデルとアクセス規則

```
Organization（クライアント会社、42社を想定）
  └─ Store（店舗。定休日ルール=StoreClosedDayRule）
       └─ Customer（storeId nullable）─ Message / Schedule / ...
User
  ├─ isStaff=false（クライアント側）: 自organizationのみ
  └─ isStaff=true（ヘヤクレス社内）: StaffOrgAccessに登録された組織を横断
```

アクセス規則（全read/writeパスで統一する）:

| 主体 | 読める範囲 | 書ける範囲 |
|---|---|---|
| クライアントユーザー | 自組織のみ | 自組織のみ |
| 社内スタッフ（isStaff） | staffAccessの全組織 | staffAccessの全組織 |
| cron/エージェント | 全組織（顧客ごとに所属組織の設定を使う） | 同左 |
| webhook | 宛先から解決した1組織のみ | 同左 |

**判定ヘルパーを1つに集約する**：`canAccessOrg(user, organizationId)` を`lib/auth.ts`に置き、ページ・API・actionすべてこれを通す（P0-3の修正で導入）。

## 3. メッセージパイプライン（Phase1＝下書き承認方式）

```
受信: Resend webhook（メール）/ LINE webhook / Twilio
  → 組織解決（現状: 1社限定の暫定。将来: 宛先ルーティング＝§4）
  → 顧客ひも付け（既存 or 新規作成）
  → Message(INBOUND)保存 ＋ hasCustomerReplied=true ＋ isNeedAction=true
  → （将来）intentCategory分類・desireSignal検出

判断: cron/agent（毎分）
  → autoReplyEnabled && autoReplyMode を必ずチェック（P0-2）
  → DRAFT_ONLY（既定）: 下書き生成のみ・送信しない（下書きパイプラインはPhase Bで実装）
  → AUTO_SEND: 現行の自動送信（機能単位で解禁していく）

送信: sendMessage action（要認証・org境界チェック＝P0-1）
  → チャンネル別送信（Resend/LINE/Twilio） → Message(OUTBOUND)保存
```

## 4. 反響メールの宛先→組織ルーティング（新規設計・Phase C実装）

現状は`resolveSingleOrgOrNull()`（1社なら使う・複数なら安全に失敗）。恒久設計：

1. `Organization.slug`を追加（例: `flat-agency`）。Store.slugは既存。
2. 受信アドレスをプラスアドレッシングで発番: `hankyo+<orgSlug>@<受信ドメイン>`、店舗特定が要る会社は `hankyo+<orgSlug>--<storeSlug>@...`
3. Resend webhookペイロードの`to`をパースして組織（＋店舗）を解決。解決できない宛先はエラーとしてSlack通知し、**推測で処理しない**。
4. 各ポータル（SUUMO等）に登録する通知先メールをこの発番アドレスにする＝ポータル側の設定だけで会社追加が完結。

## 5. スキーマ変更の運用（正式ルール化）

- **これまで**：`/api/agent/migrate`にSQL追記→デプロイ→POST（場当たり）
- **これから（Phase B）**：`prisma/migrations/`を導入し、Vercelのbuild commandに`prisma migrate deploy`を組み込む（DIRECT_URL使用）。デプロイ＝マイグレーション適用になり、手動POSTが不要になる
- `neon-init.sql`と`/api/agent/migrate*`は初期化の歴史的記録として残すが、今後の変更には使わない

## 6. 運用（Phase Bで整備）

- **エラー通知**: `lib/notify-slack.ts`を作り、cron・webhookのcatch節から`#900_dev_monitoring`（C0BHASH7LB1）へBot名義で通知。「何が落ちたか＋人手で何をすべきか」を本文に含める（ハウスルール準拠）
- **バックアップ**: Neonのブランチ/PITR設定を確認。`SUPABASE_DATABASE_URL_BACKUP`はItaruが実データ確認後に削除判断
- **認証の残存依存**: Supabase Authは使い続ける（プロジェクト削除禁止）。Auth移行は当面しない
- **依存更新**: npm audit highを解消し、以後は月次で確認

## 7. ロードマップ（フェーズ＝縦1列）

### Phase A：穴埋め（今すぐ・このPRから）
- [ ] P0-1: sendMessage/recordInboundMessage認証化＋org境界チェック
- [ ] P0-2: cron/agentをautoReplyEnabled×autoReplyModeでゲート（DRAFT_ONLY既定＝自動送信停止）
- [ ] P0-3: /customers/[id]のstaff横断アクセス対応（canAccessOrgヘルパー導入）
- [ ] P1-4の一部: 受信時にhasCustomerReplied/isNeedActionを立てる
- [ ] P1-5の最小: staff付与API（CRON_SECRET保護）＋Itaruをstaff化
- [ ] P2-10: npm audit fix

### Phase B：1社で回す（下書きパイプライン）
- [x] DRAFT_ONLY時の下書き生成（Message status=PENDING → /inboxに「承認待ち」表示 → 人が確認して送信）2026-08-30完了
- [x] エラーSlack通知（#900_dev_monitoring、cron/agent・cron/workflow・webhook email/inbound）2026-08-30完了。
      ついでにcron/workflowの`org_default`という実在しないID参照バグを発見・修正（全自動配信の変数が常に空欄だった）
- [x] prisma migrate正規化（ベースライン化＋build commandに`prisma migrate deploy`組込）2026-08-30完了。
      途中でチェックサム不一致・Preview環境のDIRECT_URL欠落を発見して修正。本番デプロイで動作確認済み
- [x] StoreRoutingPanelの結果保存（storeId書き込み＋タグ付与）2026-08-30完了
- [ ] テンプレート3重構造の整理（実装は見送り、計画のみ§8に記載。理由：今日すでにcron/agentの
      下書き生成ロジックに大きく手を入れており、同じ箇所をさらに触るリスクを避けた）

### Phase C：2社目を入れる（真の多テナント化）
- [x] Organization.slug＋宛先ルーティング（§4）2026-08-30実装・本番デプロイ済み。
      `resolveOrgByRecipient()`で`hankyo+<slug>@...`から組織を解決、slug未設定時は
      従来の1社限定フォールバックへ安全に降格する。**slugの実値はまだどの組織にも
      設定していない**（Resend/各ポータルの通知先メール変更が伴うため、値の決定は
      Itaruと相談してから）
- [x] staff管理UI（isStaff/StaffOrgAccessの画面）2026-08-30実装。`/settings/staff`に
      「全社アクセスON/OFF」トグルを追加、ON時は現存する全組織へのアクセスを自動付与
- [ ] 共通ステータス層（横断集計用のシステムステータス＋会社別表示名）未着手
- [ ] 二重対応防止ロック・「未対応最上位固定」ソート・横断クエリのページング　未着手

### Phase D：カナリー置換の本丸
- [ ] 42社の段階移行（1社ずつ並行稼働→検証→切替）
- [ ] タグ体系・追客ワークフロー高度化（TEL×LINE 14〜15ステップ）
- [ ] 一斉送信の横断対応・intentCategory自動分類の本稼働

## 8. テンプレート3重構造の整理（実装計画・未着手）

現状3箇所に分かれている：

1. **`Template`**：カテゴリ付き・UI（顧客詳細の「定型文」ボタン）から選べる、ユーザーが編集できる正規のテンプレート
2. **`AgentTemplate`**：`key`（`tpl_1st`, `tpl_tent_a`〜`d`, `tpl_confirm`, `snippet_*`等）で引く、cron/agentの下書き生成が使うテンプレート。無ければコード内`FALLBACK_TEMPLATES`定数を使う
3. **`inquiry-agent`(店舗振り分け)のdrafts.tsハードコード文字列**：`mailJP`/`mailEN`/`mailZH`等、TypeScriptの関数として直書き

### 統合方針（提案）

`AgentTemplate`を正本にし、`Template`と`drafts.ts`側を寄せる：

- **なぜAgentTemplateを正本にするか**：`key`という安定識別子を既に持っており、cron/agentのロジック（`dbTpls["tpl_1st"]`等）がこれに依存している。UIの`Template`は`name`文字列マッチ（`t.name.includes("初回")`）という脆い参照をしており、こちらを直す方が安全
- **Step 1**：`Template`に`agentKey String?`（nullable、`AgentTemplate.key`と対応）を追加。UIの「定型文」編集画面から`AgentTemplate`の内容も見えるようにする（読み取り専用でよい、まず可視化）
- **Step 2**：`FALLBACK_TEMPLATES`定数と`drafts.ts`のハードコード文字列を、初回セットアップ時に`AgentTemplate`へ流し込むseedスクリプトを書く（各会社ごとに`key`が違う可能性があるため、店舗振り分け(`flat-agency-router`)分は組織ごとの`key`プレフィックスを検討）
- **Step 3**：cron/agentの`t.name.includes("初回")`のような名前マッチを`agentKey`ベースの検索に置き換える
- **Step 4**：`drafts.ts`のメール生成関数を、ハードコード文字列ではなく`AgentTemplate`から`key`で取得する形に書き換える（`setForeignSections`と同じパターンで、DB取得結果を注入する）

### 着手のタイミング

cron/agentの下書き生成ロジック（今回のPhase Bで大きく変更済み）が本番で1〜2週間安定稼働してから着手するのが安全。同時に触ると問題の切り分けが困難になる。

## 10. 本格サービス化に向けた「手遅れリスク」総点検（2026-09-04）

前提の転換: 「まず動かす」から「ちゃんとしたサービスにする（42社の顧客個人情報を預かる）」へ。
判断基準を **「後から直すと高くつく・戻せないものを、コードが小さい今のうちに潰す」** に置き直した。
すべて 2026-09-04 に実コードを grep/読解して確認済みのもののみ。推測は書いていない。

### S: 今すぐ（データ漏えい・不可逆）

| # | 穴 | 実害 | 直し方 |
|---|---|---|---|
| S-1 | **テナント分離が各routeの手作業依存で、抜けが実在する。** `api/customers/[id]`(GET/PATCH)・`[id]/preference`・`[id]/records`・`line-link` に所属組織チェックが**ゼロ**。middleware は「ログイン済みか」しか見ない | ログイン済みなら誰でも(A社のオペ・退職者)顧客IDを指定して**他社の顧客を読める・書き換えられる**(IDOR)。42社後に1件でも起きれば信用が終わる | 短期: 全routeで `canAccessOrg` を通す。恒久: Prisma Client Extension で organizationId を自動注入 or Postgres RLS。「忘れたら漏れる」構造自体を無くす |
| S-2 | `api/organization` が `"org_default"` 直書き(**同型バグ4件目**)。GET は常に null、PUT はどこにも書かない | 組織設定画面が無音で壊れている。同じバグが4回出た＝文字列IDを直書きできる構造が原因 | 修正＋organizationId を必須引数にとるヘルパー経由に統一し、直書きを lint で禁止 |
| S-3 | Neon のバックアップ/PITR が**未確認**(neonctl 未導入、コードからは確認不能) | 消えたら戻らない | Neon ダッシュボードで手動確認・有効化(Itaru 操作) |
| S-4 | 監査ログ `AuditLog` の**呼び出し元がゼロ**(`lib/audit.ts` 定義のみ) | 個人情報を「誰がいつ見た/変えた」が残らない。個人情報保護法の安全管理措置・クライアント監査に**過去分は永久に作れない** | 顧客の閲覧/更新/送信/削除で記録。今日から貯め始めることに価値がある |

### A: 設計の不可逆性（今が一番安い）

| # | 穴 | なぜ今か | 直し方 |
|---|---|---|---|
| A-1 | Prisma 6→7/8・Next 15→16 のメジャー未実施(前回「見送り」→**撤回**) | 依存コードは増える一方。残る CVE は「踏めない」ことを確認済みだが、上げる痛みは今が最小 | S-1/S-2 でテストの土台を作ってから、検証ブランチで実施 |
| A-2 | `Customer.memo` の文字列マーカー(`[AGENT_PENDING]` 等 **13箇所**)で業務状態を管理 | 人が編集できる自由記述に状態を混ぜている。`contains` はインデックス不使用で件数増で遅化 | `agentState` 列(enum)へ移行 |
| A-3 | LINE/Twilio/Resend が**全社共通アカウント**(env 直読み 24箇所、LINE ID `@331fxngy` 直書き 3箇所) | 「自社の LINE 公式で送りたい」要件は必ず来る。後から直すと全送信経路の改修 | Organization/Store 単位の資格情報テーブル(暗号化)を先に切る |
| A-4 | ドメイン/実名のハードコード(`tama-fudosan-crm-2026.vercel.app`・`moutrenoi.resend.app`・既定担当者名: **16箇所**) | 独自ドメイン移行で全部取りこぼす | env / Organization 設定へ |
| A-5 | **単一 `CRON_SECRET`** に cron・webhook 3本・管理用 16本が全部乗る。URL クエリ `?secret=` でも受ける(アクセスログに残る)。env 未設定で認証が**消える fail-open が 5箇所** | 秘密1つ漏れ＝全権。一回限りの `migrate-neon-*`/`baseline-migrations`/`test-scrape` 等が本番に残存 | webhook は送信元固有の署名検証へ。管理用は本番から削除。fail-closed に |
| A-6 | `api/send-message` が `to`/`phone`/`lineUserId` を**リクエスト本文から**受ける | 会社名義で任意アドレスに送れる(乗っ取り/退職者アカウント経由のスパム・フィッシング) | customer レコードから導出。本文からは受けない |

### B: 規模で効いてくる

- B-1 Supabase Auth 残存依存＋**招待制なし**(`auth.ts` に「2社目で自動所属が破綻する」TODO が既にある)
- B-2 公開予約ページ(`store-visit-bookings`)がレート制限なし。任意の顧客IDの phone を上書き可(影響小・整合性)
- B-3 個人情報の**削除/保持期間の仕組みなし**(`merge` のみ)。削除依頼に応えられない
- B-4 依存の CVE 4件は「このアプリでは踏めない」ことを確認済み(§9 参照)。A-1 で同時解消

### 実施状況（2026-09-05 セキュリティ PR）

- **S-1 実装**: `requireUser` / `requireAdminUser` / `requireCustomerAccess` を `lib/auth.ts` に追加し、`customers/[id]`(GET/PATCH)・`preference`・`records`・`schedules`(全メソッド)・`line-link`・`workflow-run`・`workflows`・`templates`・`organization`・`send-message` に適用。担当者・ステータス・カテゴリ・ワークフローは「顧客の所属組織のもの」だけ受け付ける
- **S-2 実装**: `organization` に加え、点検で追加発見した `workflows`・`templates`(同型5・6件目＝定型文/追客設定画面も無音で壊れていた)を修正。再発防止として `src/lib/no-org-default.test.ts`(API route と server action に `"org_default"` リテラルがあれば失敗)を追加
- **S-4 実装**: `lib/audit.ts` を失敗しても本処理を止めない形にし、顧客閲覧・更新(項目ごと)・対応記録・希望条件・予定・LINE連携・送信・組織設定・定型文・ワークフローで記録開始
- **A-5 実装**: `lib/shared-secret.ts`(fail-closed・timingSafeEqual・ヘッダ優先)。cron はヘッダのみ、外部 webhook 3本は Resend がヘッダを付けられないためクエリ秘密鍵を**暫定許可**(次の手＝Resend の svix 署名検証。`RESEND_WEBHOOK_SECRET` の登録が要る)。一回限りの管理用 5本(`migrate`/`migrate-neon-init`/`migrate-neon-data`/`baseline-migrations`/`test-scrape`)を本番から削除
- **A-6 実装**: `send-message` の宛先を顧客レコードから導出(本文の `to`/`phone`/`lineUserId` は無視)。人間の送信に所属チェックを追加。文面の会社情報は送信者ではなく顧客の所属会社のものを使う
- **S-3 未**: Neon の PITR は Itaru がダッシュボードで確認

### 推奨順序

1. **S-1 → S-2 → S-4 → A-5 → A-6 を1本のセキュリティ PR で**(半日)。全部「今の1社でも起きうる」 → **2026-09-05 実施**
2. S-3 は Itaru が Neon ダッシュボードで確認
3. A-2 → A-4 → A-3 の順(A-3 はテーブル設計だけ先行でも可)
4. **A-1 メジャーアップは最後**(1〜3 でテストと監査ログが揃ってから検証ブランチで)
