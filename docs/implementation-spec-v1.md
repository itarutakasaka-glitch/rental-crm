# heyacules cloud 実装仕様書 v1.5

2026-09-05 作成。**「ちゃんとしたサービスにする」前提で、Phase D（カナリー置換）に入る前に確定させる仕様**。
`architecture-v2.md` が「なぜ・全体像」、この文書が「何を・どう作るか」。両方とも正本。矛盾したらこの文書を直す（実装はこの文書に従う）。

書き方のルール:
- **確定** = このとおり実装する。**提案** = Itaru の判断待ち（§9 に集約）。**現状** = 2026-09-05 のコードの事実。
- 数値・語彙は表で示す。文中の推測は書かない。

---

## 0. 用語と前提

| 用語 | 意味 |
|---|---|
| Organization（会社） | クライアント不動産会社。テナントの単位。42社を想定 |
| Store（店舗） | 会社の下の店舗。定休日・案内文・担当店舗の単位 |
| Customer（顧客） | 反響で来た見込み客。必ず1つの会社に属し、店舗は任意 |
| スタッフ | ヘヤクレス社内オペレーター。`User.isStaff=true`。`StaffOrgAccess` に登録した会社を横断できる |
| クライアントユーザー | 会社側のログインユーザー。`isStaff=false`。自社のみ |
| 下書き承認方式 | AI は下書き（`Message.status=PENDING`）まで。送信は人が承認して行う（2026-08-26 決定） |
| 所属チェック | `canAccessOrg(user, organizationId)`。ページ・API・server action の全経路で必ず通す |

---

## 1. データモデル確定仕様

### 1.1 所有スコープ（誰のデータか）

すべてのテーブルは次のどれかに属する。**スコープ外のテーブルを新設しない。**

| スコープ | テーブル | 判定キー |
|---|---|---|
| 会社 | Organization / Store / StoreClosedDayRule / Status / Template / TemplateCategory / Workflow / WorkflowStep / AgentTemplate / InitialCostRule / Property / StoreVisitSetting / StoreVisitBooking / VisitReminder / Schedule / User / StaffOrgAccess | `organizationId` |
| 顧客（→会社） | Customer / CustomerTag / InquiryProperty / WishCondition / CustomerPreference / CustomerRecord / Message / MessageEvent / WorkflowRun / WorkflowStepRun / StatusHistory / AuditLog | `customerId` → `Customer.organizationId` |
| システム | LinePending（LINE 連携の一時コード） | なし（**現状 `organizationId @default("org_default")` が残っている＝§1.4 で修正**） |

### 1.2 主要エンティティの確定項目

**Customer**（反響顧客）

| 項目 | 型 | 確定内容 |
|---|---|---|
| organizationId | 必須 | 作成時に決まり、変更しない（会社をまたぐ移動は「名寄せ」でも行わない） |
| storeId | 任意 | 店舗振り分けの結果。`StoreRoutingPanel` の適用か人の設定で入る |
| statusId | 必須 | 同じ会社の `Status` のみ（API で検証済み） |
| assigneeId | 任意 | 同じ会社の `User`、または `StaffOrgAccess` を持つスタッフのみ（API で検証済み） |
| isNeedAction | 既定 true | **横断ダッシュボードの最優先ソートキー**。受信で true、送信・架電成功で false |
| hasCustomerReplied | 既定 false | 顧客からの受信が1度でもあれば true（webhook で設定） |
| desireSignalDetectedAt | 任意 | A層判定の**初回**時刻。上書きしない |
| isBookingConfirmed | 既定 false | アポ確定文面を**実送信**した時のみ true（下書き段階では変えない） |
| lockedByUserId / lockedAt | 任意 | 二重対応防止。90秒無応答で失効 |
| memo | 任意 | 自由記述。**エージェントの状態は入れない**（§2.2 で `agentState` 列へ移行） |

**Message**（会話ログ・チャンネル共通）

| 項目 | 取りうる値 | 確定内容 |
|---|---|---|
| direction | INBOUND / OUTBOUND | |
| channel | EMAIL / LINE / SMS / CALL / NOTE / VISIT | CALL・NOTE・VISIT は顧客に届かない内部記録。二重対応ロックの対象外 |
| status | PENDING / SENT / DELIVERED / FAILED / BOUNCED | PENDING＝下書き承認待ち。§2.3 |
| intentCategory | VIEWING_REQUEST / VIEWING_RESCHEDULE / SIMILAR_PROPERTY_REQUEST / CONDITION_CHANGE / PRICE_OR_FEE_INQUIRY / PROPERTY_QUESTION / DECLINE / BROUGHT_IN_URL_INQUIRY | INBOUND のみ。cron/agent の分類と同じ LLM 呼び出しで付与 |
| senderId | 任意 | 人が送った場合のみ。cron/agent の送信は null |

**Status**（会社ごとの対応ステータス）

| 項目 | 確定内容 |
|---|---|
| name / color / order | 会社が自由に定義（最大20） |
| systemCategory | NEW / IN_PROGRESS / DONE / CLOSED / null。横断集計・横断フィルタはこれだけを使う。**会社の Status には必ず1つ以上 NEW を割り当てる**（未設定の会社は横断集計に出ない旨を設定画面に表示） |

**Organization / Store**

| 項目 | 確定内容 |
|---|---|
| Organization.slug | 反響メール宛先 `hankyo+<slug>@…` の判別キー。英小文字・数字・ハイフンのみ、会社追加時に必ず付ける（§5.2） |
| autoReplyEnabled × autoReplyMode | 自動送信は `true × AUTO_SEND` の会社のみ。既定 DRAFT_ONLY |
| Store.slug | 会社内で一意。`hankyo+<orgSlug>--<storeSlug>@…` で店舗まで特定できる |
| Organization.store*（storeName 等の平坦な項目） | **単一店舗時代の名残。新規は Store に書く**。既存参照が多いため Phase D-1 で「既定店舗（isDefault）の値を返す互換層」を作って読み替え、その後削除（§1.4） |

### 1.3 テンプレートの正本

| 種別 | テーブル | 用途 | 変数 |
|---|---|---|---|
| 人が選ぶ定型文 | Template（category 付き） | 送信パネルの「定型文」 | `{{customer_name}}` `{{company_name}}` `{{store_name}}` `{{store_address}}` `{{store_phone}}` `{{store_hours}}` `{{line_url}}` `{{license_number}}` `{{property_name}}` `{{property_url}}` `{{staff_name}}` `{{visit_url}}` |
| エージェントが引く文面 | AgentTemplate（key） | cron/agent・店舗振り分けの下書き | 同上 ＋ `{visit_proposal}` `{store_access}` `{appointment_datetime}` |
| 橋渡し | Template.agentKey | 同じ文面を両方から引く | |

確定: **新しい変数は上の表に追記してから使う**。変数の置換関数は現状3箇所（`customer-detail.tsx` / `send-message/route.ts` / `workflow-run/route.ts`）に重複しているため `lib/template-vars.ts` に1本化する（Phase D-0）。

### 1.4 直す・足す・消す（スキーマ変更予定）

| # | 変更 | 理由 | フェーズ |
|---|---|---|---|
| M-1 | `Customer.agentState`（enum）を追加し、memo の `[AGENT_PENDING]` 等の文字列マーカーを廃止 | 人が編集できる自由記述に業務状態を混ぜている。`contains` 検索はインデックスが効かない | D-0 |
| M-2 | `LinePending.organizationId` の既定 `"org_default"` を廃止し必須化。LINE の友だち追加を会社ごとの LINE 公式に紐付ける | 同型バグの温床 | D-0 |
| M-3 | `OrganizationChannel`（会社ごとの LINE / SMS / メール送信元と秘密情報、暗号化）を追加 | 全社共通アカウントでは各社の LINE 公式に対応できない（§6） | D-1 |
| M-4 | `AuditLog` に `organizationId` と `ip` を追加し `@@index([organizationId, createdAt])` | 会社ごとの監査抽出と保持期間の適用に必要 | D-0 |
| M-5 | `Customer` に `@@index([organizationId, isNeedAction, updatedAt])` | 横断 inbox のソート・ページングをインデックスで支える | D-0 |
| M-6 | `StoreVisitBooking.status` を enum 化（PENDING / CONFIRMED / REJECTED / CANCELLED）＋ `confirmedBy`（SCHEDULE_LINK / STAFF_CONTACT）＋ `confirmedAt` ＋ `confirmedByUserId` | セルフ予約は「連動あり＝即時確定／連動なし＝担当者の連絡で確定」（§2.5、2026-09-05 決定） | D-1 |
| M-10 | `StoreScheduleLink`（店舗ごとの外部カレンダー連動設定: provider・カレンダーID・認証情報(暗号化)・営業時間枠・1枠の長さ） | F-21 店舗スケジュール連動（§6.2） | D-1 |
| M-11 | `Organization.routerConfigCache`（JSON）と `routerConfigFetchedAt` | 会社別の店舗振り分けルールをマニュアルB から取得してキャッシュ（§4.2） | D-1 |
| M-12 | `Organization.tagPresets`（文字列配列） | タグ候補（§4.3） | D-1 |
| M-13 | `Organization.isTest`（既定 false） | 権限総当たりテスト用の組織を横断 inbox・集計・cron から除外（§8.1b） | D-0 |
| M-7 | `Organization.store*` の平坦項目を Store（isDefault）へ寄せて削除 | 二重管理の解消 | D-2 |
| M-8 | `Customer` に `anonymizedAt` を追加 | 保持期間経過後の匿名化（§7.3） | D-1 |
| M-9 | `Customer` に `importedFrom`（"canary" 等）と `importedAt` を追加 | 移行元の追跡（§5.2）。memo に書かない | D-1 |

---

## 2. 状態遷移の定義

### 2.1 顧客の対応状態（人が見る状態）

「対応が必要か」は `isNeedAction`、「どの段階か」は会社の `Status`（横断では `systemCategory`）で表す。2軸を混ぜない。

| きっかけ | isNeedAction | Status |
|---|---|---|
| 反響受信（新規作成） | true | 会社の既定ステータス（isDefault） |
| 顧客からの受信（メール/LINE/SMS） | true | 変えない |
| 人が送信（EMAIL/LINE/SMS）・架電成功 | false | 変えない（人が必要なら変える） |
| AI の下書き生成（DRAFT_ONLY） | true（承認待ちがあることを示す） | 変えない |
| 承認して送信 | false | 変えない |
| アポ確定文面を実送信 | false ＋ isBookingConfirmed=true | 会社が「アポ確定」に相当する Status を持つ場合は人が変更（自動では変えない） |
| 予約（セルフ予約）リクエスト | true | 変えない |

### 2.2 エージェント処理状態（`Customer.agentState`・M-1）

現状の memo マーカーを列挙し、enum に置き換える。**遷移はこの表以外に作らない。**

| 現状マーカー | 新 agentState | 遷移元 | 遷移先 | 誰が |
|---|---|---|---|---|
| `[AGENT_PENDING]` | FIRST_MAIL_PENDING | 反響受信（メールあり） | FIRST_MAIL_DRAFTED / FIRST_MAIL_SENT | cron/agent |
| `[AGENT_DRAFT_READY]` | FIRST_MAIL_DRAFTED | FIRST_MAIL_PENDING（DRAFT_ONLY） | WAITING_REPLY（承認送信時） | 人（承認） |
| `[AGENT_DONE]` | WAITING_REPLY | 初回送信済み | CLASSIFY_PENDING（受信時） | webhook |
| `[CLASSIFY_PENDING]` | CLASSIFY_PENDING | WAITING_REPLY で受信 | CLASSIFIED_A / CLASSIFIED_B / CLASSIFIED_C | cron/agent |
| `[AI分類:A層]` | CLASSIFIED_A | CLASSIFY_PENDING | CONFIRM_PENDING（次の受信時） | webhook |
| `[AI分類:B層]` / `[AI分類:C層]` | CLASSIFIED_B / CLASSIFIED_C | CLASSIFY_PENDING | CLASSIFY_PENDING（次の受信時に再分類） | webhook |
| `[CONFIRM_PENDING]` | CONFIRM_PENDING | CLASSIFIED_A で受信 | BOOKED（実送信）/ BOOKING_DRAFTED（下書き）/ CLASSIFIED_A（不承諾） | cron/agent |
| `[アポ確定・下書き]` | BOOKING_DRAFTED | CONFIRM_PENDING（DRAFT_ONLY） | BOOKED（承認送信時） | 人 |
| `[アポ確定]` | BOOKED | 確定文面を実送信 | 終端（人が Status で管理） | cron/agent / 人 |
| （なし） | MANUAL | 人が「AI を止める」を押した | 終端 | 人 |
| （なし） | NONE | メールも LINE も無い顧客 | — | 作成時 |

ルール:
- cron/agent は `agentState in (FIRST_MAIL_PENDING, CLASSIFY_PENDING, CONFIRM_PENDING)` だけを拾う（毎分・各5件）。
- 人が Status を「対応不要/失注」（systemCategory=CLOSED）に変えたら agentState=MANUAL にする（AI が追いかけない）。
- 移行: 既存 memo のマーカーを1回のスクリプトで agentState に変換し、memo からマーカー文字列を除去する。変換表は上の表。

### 2.3 Message.status（送信物の状態）

| 遷移 | 誰が | 備考 |
|---|---|---|
| （生成）→ PENDING | cron/agent（DRAFT_ONLY）・人の送信直前 | PENDING は「まだ届いていない」 |
| PENDING → SENT | 承認送信・送信成功 | `senderId` に承認者 |
| PENDING → FAILED | 却下・送信失敗 | 却下は body を残す |
| SENT → DELIVERED / BOUNCED | Resend / LINE の配信イベント | `MessageEvent` に生イベント |
| SENT →（openedAt, openCount） | 開封ピクセル | 状態は変えない |

### 2.4 追客ワークフロー

| 状態 | 遷移 |
|---|---|
| WorkflowRun: RUNNING → COMPLETED | 最終ステップ送信後（cron/workflow） |
| RUNNING → STOPPED_BY_REPLY | 顧客受信（webhook）・別ワークフロー開始・人の停止（**現状「Manual stop」も STOPPED_BY_REPLY を使っている＝STOPPED_MANUAL に直す**） |
| RUNNING → STOPPED_BY_LINE_ADD | LINE 友だち追加 |
| RUNNING → STOPPED_BY_VISIT / STOPPED_BY_CALL | 来店予約承認・架電成功（**現状未実装＝D-1 で配線**） |
| StepRun: PENDING → SENT / FAILED / CANCELLED / SKIPPED | cron/workflow |

### 2.5 セルフ予約（StoreVisitBooking・M-6）— 2026-09-05 Itaru 決定

**予約を入れた時点では確定しない**（店舗のスケジュールと連動していない限り、空いているか分からないため）。確定の仕方は店舗の状態で2つに分かれる。

| 店舗の状態 | 予約リクエスト時 | 確定の条件 |
|---|---|---|
| **店舗スケジュール連動あり**（F-21） | 連動先の空き状況を照会し、**空いていれば即時確定**（CONFIRMED / confirmedBy=SCHEDULE_LINK）。埋まっていれば別候補を返す | 連動先に予定を書き込めた時 |
| **連動なし** | **未確定（PENDING）**として受け付け、顧客には「店舗から確認の連絡をします」と即時返信 | **担当者が顧客に連絡した事実をもって確定**（CONFIRMED / confirmedBy=STAFF_CONTACT）。担当者が詳細画面で「連絡済み・確定」を押す＝架電記録（CustomerRecord type=CALL）か送信と同時に確定できる |

状態: PENDING → CONFIRMED / REJECTED（店舗都合で不可・別候補を案内）/ CANCELLED（顧客都合）。
CONFIRMED 時に `Schedule(type=VISIT)` を作り（連動ありは連動先にも書き込み）、`WorkflowRun` を STOPPED_BY_VISIT、`Customer.isBookingConfirmed=true` にする。
未確定のまま放置される予約は横断 inbox で「未確定予約」として上位に出す（isNeedAction=true）。承認期限（旧 Q-5）は設けない。

### 2.6 二重対応防止ロック

取得: 詳細画面を開く → `POST /api/customers/[id]/lock`（30秒ごと再送）。他人のロックが90秒以内なら 409。
効力: EMAIL/LINE/SMS の送信をサーバ側で拒否（`actions/send-message.ts` と `api/send-message`）。CALL/NOTE は対象外。
解放: 画面離脱で DELETE。失効は時間で自動。

---

## 3. API と権限の一覧表（現状＝2026-09-05）

凡例 — 認証: **S**=ログインセッション、**Sc**=セッション＋所属チェック(`requireCustomerAccess`/`canAccessOrg`)、**Sa**=セッション＋管理者、**K**=共有秘密鍵（ヘッダ）、**Kq**=共有秘密鍵（クエリも可・外部 webhook）、**L**=LINE 署名、**P**=公開。
監査: ✔=AuditLog 記録あり。状態: ✅=仕様どおり、⚠=直す（内容を右に）。

| ルート | メソッド | 認証 | スコープ | 監査 | 状態 |
|---|---|---|---|---|---|
| /api/customers | GET, POST | S | 自組織（+staff 横断） | | ⚠ POST の監査ログ追加 |
| /api/customers/[id] | GET, PATCH | Sc | 顧客の会社 | ✔ | ✅ |
| /api/customers/[id]/preference | GET, PUT | Sc | 顧客の会社 | ✔ | ✅ |
| /api/customers/[id]/records | GET, POST | Sc | 顧客の会社 | ✔ | ✅ |
| /api/customers/[id]/schedules | GET, POST, PATCH, DELETE | Sc | 顧客/予定の会社 | ✔ | ✅ |
| /api/customers/[id]/lock | POST, DELETE | Sc | 顧客の会社 | | ✅ |
| /api/customers/[id]/duplicates | GET | S | | | ⚠ 所属チェックを `requireCustomerAccess` に統一 |
| /api/customers/duplicates | GET | S | 自組織 | | ✅ |
| /api/customers/merge | POST | S | 自組織 | | ⚠ 監査ログ（customer.merge）追加。両顧客が同じ会社か検証 |
| /api/customers/preference | GET, POST | S | **なし** | | ⚠ 顧客ID受け取り→`requireCustomerAccess` |
| /api/send-message | POST | Sc / K(agent) | 顧客の会社 | ✔ | ✅ 宛先は顧客レコードから導出 |
| /api/messages/[id]/approve | POST, DELETE | Sc | 顧客の会社 | | ⚠ 監査ログ（message.approve / reject）追加 |
| /api/broadcast | POST | S | 自組織 | | ⚠ 監査ログ追加。staff の横断一斉送信は Phase D |
| /api/organization | GET, PUT | S / Sa | 自組織 | ✔ | ✅ |
| /api/statuses | GET, POST, PATCH, PUT, DELETE | S | 自組織 | | ⚠ 監査ログ追加 |
| /api/templates | GET, POST, PUT, DELETE | S | 自組織 | ✔ | ✅ |
| /api/workflows | GET, POST, PUT, PATCH | S | 自組織 | ✔ | ✅ |
| /api/workflow-run | GET, POST, PATCH | Sc | 顧客の会社 | ✔ | ✅ |
| /api/staff | GET, POST, PATCH | S | 自組織 | | ⚠ 管理者限定（Sa）＋監査ログ。staff 付与は最重要操作 |
| /api/settings/hankyo | GET, PUT | S | 自組織 | | ⚠ 監査ログ |
| /api/store-visit-settings | GET, PUT | S | 自組織 | | ⚠ 監査ログ |
| /api/reminders | GET, POST, PUT, DELETE | S | 自組織 | | ⚠ 監査ログ |
| /api/properties | GET | S | 自組織 | | ✅ |
| /api/line-link | POST | Sc | 顧客の会社 | ✔ | ✅ |
| /api/agent/store-routing, /apply | POST | S / Sc | | | ✅ |
| /api/agent/templates, snippets, cost-rules | GET, PUT, DELETE | S (+K) | 自組織 | | ⚠ 監査ログ |
| /api/agent/context/[customerId], queue, send, notify | GET/POST | K | 全社（エージェント） | | ⚠ `verifySharedSecret` に統一（現状は独自比較） |
| /api/agent/grant-staff, seed-* | POST | K | | | ⚠ 実行を監査ログに残す。seed は初期投入後に削除候補 |
| /api/cron/agent, /cron/workflow | GET | K | 全社（顧客ごとに会社設定） | | ⚠ `verifySharedSecret` に統一 |
| /api/cron/timeout-check | GET | K | | | ✅ |
| /api/webhook/email, mail, inbound | POST | Kq | 宛先で解決した1社 | | ⚠ Resend の svix 署名検証へ（`RESEND_WEBHOOK_SECRET`） |
| /api/webhook/line | POST | L | LINE 公式ごと（§6） | | ✅（会社別 LINE は §6） |
| /api/public/visit/[orgId], /api/store-visit-bookings | GET / POST | P | 会社（URL） | | ⚠ レート制限（IP あたり 10回/分）・顧客IDの phone 上書きを廃止 |
| /api/track/open/[messageId] | GET | P | | | ✅（更新は openedAt/openCount のみ） |
| /api/auth/callback | GET | P | | | ✅ |

確定ルール:
1. 新規 route は必ず上の凡例のどれかを名乗り、この表に行を足してから実装する。
2. 顧客IDを受け取る route は `requireCustomerAccess` 以外で所属を判定しない。
3. 会社設定を変える route（Sa 相当）は管理者のみ。staff 付与・組織設定・秘密情報の変更は必ず監査ログ。
4. 公開 route（P）は書き込み内容を最小にし、レート制限を入れる。

---

## 4. カナリー同等機能の定義（1社目を切り替える最低条件）

カナリーの実機で確認した構造（`store-hierarchy-design.md`）と現場の使い方から、**「これが無いと業務が止まる」を MUST、「無くても回るが早期に要る」を SHOULD** に分ける。

| # | 機能 | 区分 | 現状 | 残作業 |
|---|---|---|---|---|
| F-1 | 顧客一覧＝受信トレイ（最新のやりとり順・未対応が上・会社/店舗列） | MUST | あり | 店舗フィルタ（3段階ドリルダウンの3段目） |
| F-2 | 会社/店舗の切替（スタッフ） | MUST | 会社まで | 店舗まで |
| F-3 | ステータス（会社別・横断カテゴリ） | MUST | あり | 会社ごとに NEW 必須の検証 |
| F-4 | タグ（顧客タグ） | MUST | テーブルあり・UI なし | 一覧フィルタ・詳細で付け外し・店舗振り分けが自動付与 |
| F-5 | 反響元（sourcePortal）と反響内容・物件 | MUST | あり（SUUMO/アパマン/HOME'S パーサ） | 会社が使うポータル別パーサの追加（アットホーム・スモッカ・エイブル系） |
| F-6 | 会話タイムライン（メール/LINE/SMS/架電/メモ統合） | MUST | あり | 添付ファイルの表示 |
| F-7 | 統合コンポーザー（定型文・変数・SMS分割・NG表現警告） | MUST | あり | 添付、LINE 画像 |
| F-8 | 下書き承認（承認待ち一覧・承認/却下） | MUST | あり | 却下理由の保存 |
| F-9 | 追客ワークフロー（日数×時刻×チャンネル） | MUST | あり | 停止理由の正確化（§2.4）、TEL×LINE 14〜15ステップの雛形 |
| F-10 | 対応記録（架電結果・来店記録） | MUST | あり | |
| F-11 | 二重対応防止 | MUST | あり | |
| F-12 | 店舗振り分け（定休日ルール） | MUST（フラットエージェンシー） | あり（1社固有） | **会社別ルールの正本はマニュアルB の YAML（`router_config`）**。§4.2 |
| F-13 | 名寄せ（重複顧客の統合） | SHOULD | あり | 監査ログ |
| F-14 | 一斉送信 | SHOULD | 自組織のみ | staff の横断 |
| F-15 | 来店セルフ予約（連動なしは未確定→担当者の連絡で確定） | SHOULD | 自動確定（誤り） | §2.5 の2方式へ（M-6）。詳細画面に「連絡済み・確定」操作 |
| F-21 | 店舗スケジュール連動（空き照会・予定書き込み・即時確定） | SHOULD（連動する店舗のみ MUST） | なし | M-10。連動先の決定（Q-7）→ 空き照会 API → 予約時の即時確定 |
| F-16 | レポート（反響数・初回返信までの時間・アポ率・会社別） | SHOULD | `/analytics` 骨組み | 定義（§4.1）に合わせて再実装 |
| F-17 | 検索（氏名・電話・メール・物件名） | MUST | 一覧の絞り込みのみ | 横断検索 |
| F-18 | 会社ごとの LINE 公式・送信ドメイン | MUST（2社目以降） | 全社共通 | §6 |
| F-19 | 反響メールの会社判別（宛先） | MUST（2社目以降） | あり（slug 未設定） | 会社ごとの slug 付与とポータル通知先変更（§5.2） |
| F-20 | 通知（Slack への未対応・障害） | SHOULD | 障害のみ | 未対応滞留の通知 |

### 4.1 レポート指標の定義（F-16）と画面

| 指標 | 定義 |
|---|---|
| 反響数 | 期間内に作成された Customer（会社・店舗・反響元別） |
| 初回返信時間 | Customer.createdAt → 最初の OUTBOUND(EMAIL/LINE/SMS, status=SENT).createdAt の中央値 |
| 返信率 | hasCustomerReplied=true の割合 |
| アポ率 | isBookingConfirmed=true の割合 |
| 未対応滞留 | isNeedAction=true かつ 最終 OUTBOUND から 24h 超の件数 |

**画面 `/analytics`**: 期間（今日／今週／今月／任意）と会社・店舗・反響元の絞り込み。上段に5指標の数値タイル（横並び可＝KPIタイルの例外）。下段は縦1列で「反響元別」「店舗別」「担当者別」の表（各行に反響数・初回返信時間・返信率・アポ率）。staff は全社横断で会社別の表が先頭に出る。集計は `/api/analytics?from&to&organizationId&storeId` が返し、SQL は `Customer` と `Message` の集計のみ（他テーブルを結合しない）。42社×数千件でも 2秒以内（M-5 の索引と `createdAt` 索引を使う）。

### 4.2 会社別の店舗振り分けルール（F-12）の持ち方

ヘヤクレスの標準（CLAUDE.md）に合わせ、**可変データはマニュアルB の YAML（`heyacules-manual-b` の `data/<code>.yaml` の `router_config`）を唯一の正本**にし、CRM はそれを配信 API（`manual.heyacules.com/api/router-config`）から取得して使う。Chrome 拡張（inquiry-agent）と同じ設定を共有するので、判定基準が拡張と CRM で食い違わない。

| 項目 | 仕様 |
|---|---|
| 取得 | `/api/router-config?code=<会社コード>` を起動時＋5分ごとに取得し、`Organization.routerConfigCache`（JSON・M-11）に保存。取得失敗時はキャッシュを使い、24時間更新できなければ Slack 通知 |
| 判定 | 現在の `flat-agency-router.ts` の判定木を、YAML の `router_config`（対応不要条件・短期/テナントの LINE 投稿先・受験生ルール・言語→店舗・元付→店舗・反響店舗記載）を読む汎用版に書き換える。判定順は現状の優先順位を保つ（テストの16件を汎用版でも全件通す） |
| 会社差 | ルールが無い会社は「既定店舗（isDefault）」に振り分け、判定理由に「ルール未設定」を残す |
| 変更の反映 | マニュアルB の編集画面で YAML を直す → 5分以内に CRM へ反映。CRM 側に設定画面は作らない（二重管理を避ける） |
| 判定基準の共有 | 各分岐の「●●を検出したら××」をクライアントに事前共有する（CLAUDE.md の拡張標準仕様 7 と同じ）。判定ロジックを変えたら共有文書も同時に更新 |

### 4.3 タグ（F-4）の仕様

| 要素 | 仕様 |
|---|---|
| データ | `CustomerTag(customerId, name)`。会社ごとのタグ候補は `Organization.tagPresets`（文字列配列・M-12）。候補に無い自由入力も可（候補は補完用） |
| 詳細画面 | 顧客名の下にタグをチップ表示。「＋」で候補から選ぶか入力。× で外す。付け外しは `logAudit`（`customer.tag.add/remove`） |
| 一覧 | 横断 inbox とお客様一覧にタグ列（最大3つ表示、残りは「+n」）。左のフィルタに「タグ」を追加（複数選択＝OR） |
| 自動付与 | 店舗振り分けの適用時に店舗名タグ（現状どおり）。A層判定時に「意欲あり」タグ。アポ確定時に「アポ確定」タグ。自動付与のタグ名は会社の `tagPresets` にあれば表示名をそれに合わせる |
| 移行 | カナリーのタグをそのまま `CustomerTag.name` に入れる（§5） |

---

## 5. カナリーからのデータ移行計画

### 5.1 対象と対応表

| カナリー | heyacules cloud | 備考 |
|---|---|---|
| テナント（slug） | Organization（slug は**ポータルのブックマーク一覧**を正本にする。ID/PASS 一覧の URL は誤登録が多く使わない） | 既存ルール |
| 店舗（担当店舗列） | Store | 単一店舗の会社は isDefault の店舗を自動生成 |
| 顧客（氏名・連絡先・反響元・物件・反響内容） | Customer / InquiryProperty | 電話・メールは正規化（ハイフン除去・小文字） |
| 会話（メール/LINE の送受信） | Message（direction・channel・createdAt を保持） | 本文は原文のまま。添付は URL のみ |
| ステータス | Status（会社の名前をそのまま作り、systemCategory を人が割当） | |
| タグ | CustomerTag | |
| 担当者 | User（メールで突合、無ければ null） | |
| メモ | Customer.memo | マーカーは入れない |

取り出し手段: 既存の canary MCP（`canary_list_customers` / `canary_get_conversation` / `canary_dump_inquiry`）。**必ず client（テナント）を指定して呼ぶ**（未指定だと登録全社のブラウザが一斉に開く既知事故）。

### 5.2 手順（会社ごと）

1. **準備**（人）: Organization.slug を決めて設定。Store と定休日を登録。Status と systemCategory を設定。担当 User を招待。
2. **ドライラン**（スクリプト）: カナリーから読み取り → 変換 → 件数・欠損・重複を CSV で報告。**DB には書かない**。
3. **初回取り込み**: ドライランの結果を Itaru が承認 → 書き込み。`Customer.memo` 先頭に `[移行: カナリー <日付>]` ではなく `sourcePortal` とは別の `importedFrom="canary"` 列（M-9 として追加）に記録。
4. **並行稼働（2週間）**: ポータルの通知先を `hankyo+<slug>@…` に変え、両方に反響が入る状態にする。差分取り込みを毎日1回（作成日で増分）。
5. **切替**: オペレーターの操作をこちらに一本化。カナリーは読み取り専用で1か月残す。
6. **終了**: 契約解除。取り込んだ個人情報の保管は §7.3 に従う。

### 5.2b 移行スクリプトの設計（`scripts/migrate-from-canary.ts`・D-1）

| 段階 | 処理 | 出力 |
|---|---|---|
| 0 準備 | 引数: `--client <カナリーslug> --org <Organization.id> [--since YYYY-MM-DD] [--apply]`。`--apply` が無ければドライラン | |
| 1 読み取り | canary MCP を **client 指定で**呼ぶ: `canary_list_customers`（顧客一覧・ページング）→ 顧客ごとに `canary_get_conversation`（会話）と `canary_dump_inquiry`（反響原文）。`--since` 以降の作成分だけ（差分取り込み用） | 一時 JSON（scratchpad。実行後に削除） |
| 2 変換 | §5.1 の対応表で変換。電話はハイフン除去、メールは小文字。担当店舗名 → `Store`（無ければ作成候補として報告）。ステータス名 → `Status`（無ければ作成候補）。担当者名 → `User`（メールで突合、無ければ null） | |
| 3 突合 | 既存 `Customer` と **メール or 電話** が一致すれば「更新（会話の追記のみ）」、一致しなければ「新規」。同一カナリー顧客の再取り込みは `importedFrom="canary"` ＋ カナリー側ID（`CustomerRecord(type="IMPORT", body=カナリーID)`）で判定し二重作成しない | |
| 4 ドライラン報告 | CSV（**氏名・連絡先・本文は出さない**）: 新規件数／更新件数／店舗の作成候補一覧／ステータスの作成候補一覧／担当者が突合できなかった件数／会話の総件数／欠損（メールも電話も無い）件数 | `migration-report-<client>-<日付>.csv` |
| 5 適用 | Itaru が報告を見て店舗・ステータスの対応を確定 → `--apply` で書き込み。1顧客ずつトランザクション。失敗は件数だけ集計して最後に Slack 通知 | 適用件数のサマリ（JSON） |
| 6 検証 | 取り込み後に `Customer` 件数・`Message` 件数がドライランの見込みと一致するか照合。不一致なら差分を報告 | |

注意: canary MCP は client 未指定だと登録全社のブラウザが一斉に開く。スクリプトは `--client` を必須にする。

### 5.3 個人情報の扱い

- ドライランの CSV は件数と欠損のみ（氏名・連絡先を出力しない）。
- 取り込みスクリプトの実行ログに本文・連絡先を出さない。
- スクリーンショットは保存しない（これまでのルールを継続）。

---

## 6. 会社ごとの外部連携（M-3: OrganizationChannel）

```
OrganizationChannel
  id, organizationId, storeId?(店舗別にしたい場合)
  type:        EMAIL | LINE | SMS
  provider:    resend | line | twilio
  fromName, fromAddress          (EMAIL)
  lineChannelId, lineBasicId     (LINE。@331fxngy のような友だち追加ID)
  smsFromNumber                  (SMS)
  secretEnc  Bytes               (channel access token / auth token を AES-256-GCM で暗号化)
  webhookSecretEnc Bytes         (LINE channel secret / Resend signing secret)
  isActive, createdAt, updatedAt
  @@unique([organizationId, storeId, type])
```

確定:
- 暗号鍵は環境変数 `CHANNEL_SECRET_KEY`（32 byte）。DB に平文の秘密情報を置かない。ローテーションは「新鍵で再暗号化」スクリプトで行う。
- 解決順: 店舗 → 会社 → システム既定（現在の環境変数）。既定が無い会社は送信を拒否し Slack へ通知（黙って別会社の名義で送らない）。
- LINE webhook は `/api/webhook/line/[channelId]` にし、チャンネルごとの secret で署名検証する。
- 文面の `{{line_url}}` は OrganizationChannel(LINE).lineBasicId から生成。ハードコード `@331fxngy` を廃止。

---

### 6.1 会社ごとの外部連携の設定画面と移行（`/settings/channels`）

**画面**（会社の管理者のみ。staff は会社を切り替えて操作可）

| 要素 | 仕様 |
|---|---|
| 一覧 | 縦1列のカード。1カード＝1連携（EMAIL / LINE / SMS）。店舗別に分けた場合は「店舗名」バッジ。状態バッジ: 有効 / 無効 / 未設定（システム既定を使用中） |
| EMAIL カード | 送信元名（fromName）・送信元アドレス（fromAddress。ドメインは Resend で認証済みのものだけ選択可）・返信先アドレス（`hankyo+<slug>@…` を自動表示、編集不可） |
| LINE カード | チャネルID・チャネルシークレット（入力後はマスク表示）・アクセストークン（同）・友だち追加ID（`@xxxx`）。保存時に LINE の `GET /v2/bot/info` を叩いて疎通確認し、失敗なら保存しない。**webhook URL を画面に表示**（`/api/webhook/line/<channelId>`）して、会社側で LINE Developers に貼ってもらう |
| SMS カード | Twilio の送信元番号・Account SID・Auth Token（マスク）。保存時に Twilio の番号照会で疎通確認 |
| 共通 | 「テスト送信」ボタン（管理者自身のメール／LINE／SMS へ1通）。保存・無効化・削除は `logAudit`（`channel.update` 等、秘密情報は値を記録しない） |

**解決順とフォールバック**: 店舗の連携 → 会社の連携 → システム既定（環境変数）。**会社の連携が「無効」の時は既定に落とさず送信を拒否**し、Slack へ通知（他社名義での誤送信を防ぐ）。「未設定」の時だけ既定を使う（1社目の移行期間用。D-2 で既定を廃止）。

**既存からの移行**: 現在の環境変数（Resend / LINE / Twilio）の値をフラットエージェンシーの会社連携として画面に「既定値」として表示し、管理者が保存した時点で DB に暗号化保存。全社で保存が終わったら環境変数側を削除。ハードコード `@331fxngy` は LINE カードの友だち追加IDに置き換える。

**LINE webhook の会社別化**: `/api/webhook/line/[channelId]` を新設し、`channelId` で `OrganizationChannel` を引いてそのチャネルシークレットで署名検証する。既存の `/api/webhook/line` は既定チャネルとして残し、D-2 で廃止。`LinePending.organizationId` はこの時点で必須化（M-2 の完了）。

### 6.2 店舗スケジュール連動（F-21 / M-10）— 連動先ごとの方式

会社（店舗）が使っているカレンダーはまちまちなので、**連動先を差し替えられる共通の接続口**（`StoreScheduleLink.provider`）を切り、連動先ごとに「空き照会」と「予定書き込み」の2操作だけを実装する。CRM 内の予約枠（INTERNAL）は常に持ち、外部連動はその上に重ねる。

| provider | 空き照会 | 予定書き込み | 認証 | 可否・注意（2026-09-05 時点の見立て。**実装前に各APIの現行仕様を確認する**） | 順序 |
|---|---|---|---|---|---|
| INTERNAL（CRM 内の枠） | 営業時間×1枠の長さ×定休日ルールから算出 | Schedule(type=VISIT) | 不要 | 連動先が無い店舗の基盤。まずこれで「連動あり＝即時確定」を成立させる | 1 |
| GOOGLE_CALENDAR | Calendar API freebusy | events.insert | 店舗担当者の Google アカウントで OAuth（同意画面は既存の heyacules-manual の設定を触らず、CRM 用に別途作る） | API が安定しており最も確実。店舗ごとにカレンダーIDを指定 | 2 |
| CYBOZU（サイボウズ Office / Garoon） | Garoon: スケジュール REST API / Office: API が限定的 | 同左 | 会社の cybozu.com アカウント（API トークン or Basic） | Garoon は可。**サイボウズ Office は API が限られるため要確認**（できなければ Office は「連動なし」扱い） | 3 |
| TIMETREE | — | — | — | **TimeTree の公開 API は提供終了の可能性が高い（要確認）**。使えなければ「連動なし」扱いにし、予約確定後の予定を共有カレンダーへ手動登録する運用 | 4（可否確認のみ先に） |
| CANARY（カナリークラウド内のスケジュール） | 公開 API なし。既存の canary MCP（ブラウザ自動化）で読む | 同左（書き込みも自動化） | 店舗別のカナリー資格情報（既存） | **並行稼働期間だけの暫定**。置換が終われば不要になるので、作り込まない（読み取りで空きを見て CRM 内枠に反映する程度） | 並行稼働中のみ |

確定ルール:
- 連動先が **INTERNAL 以外で有効**な店舗＝「連動あり」。予約リクエスト時に空き照会し、空いていれば即時確定＋連動先に書き込み。書き込みに失敗したら未確定に落として担当者へ通知（黙って確定にしない）。
- 連動先が無い／失敗中の店舗＝「連動なし」。§2.5 のとおり担当者の連絡で確定。
- 認証情報は §6 と同じ暗号化（`CHANNEL_SECRET_KEY`）。

## 7. 運用要件（数値）

| 項目 | 確定値 | 根拠 |
|---|---|---|
| バックアップ RPO | 1時間以内（Neon PITR 有効化・履歴7日以上） | **S-3: Itaru がダッシュボードで確認** |
| 復旧 RTO | 4時間以内 | 手順書を `docs/runbook-restore.md` に置く（D-0） |
| 監査ログ保持 | 5年 | 宅建業法の帳簿保存（5年）に合わせる |
| 個人情報の保持 | **最終接触から5年で匿名化**（氏名・連絡先・本文を不可逆にマスク、統計用の日付・反響元は残す） | 決定（Q-1・2026-09-05） |
| 削除依頼 | 受領から7営業日以内に匿名化 | 確定（保持期間内でも依頼があれば消す） |
| 障害通知 | すべて Slack #900_dev_monitoring へ Bot 名義。個人メール宛は禁止 | ハウスルール |
| cron | agent 毎分（各処理5件）・workflow 毎時 | 現状 |
| 公開 route のレート制限 | IP あたり 10回/分 | §3 |
| 依存更新 | 月次で npm audit。メジャーアップは検証ブランチで（A-1） | |

---

## 8. 受け入れ条件とテスト方針

### 8.1 テストの層

| 層 | 対象 | 手段 | 現状 |
|---|---|---|---|
| 単体 | 店舗振り分け、変数置換、agentState 遷移、`no-org-default` | `tsx --test` | 17件 |
| 権限 | §3 の表を **2社＋staff の3ユーザー**で総当たり（自社=200、他社=403、未ログイン=401/307） | 本番に「テスト専用 Organization 2社」（個人情報なし）を seed し、API を直接叩く（Q-6 決定: staging は作らない） | **なし（D-0 で作る）** |
| 監査 | 主要操作後に AuditLog が1行以上 | 同上 | なし |
| E2E | 反響受信→下書き→承認→送信→受信→分類→アポ確定 | 本番のテスト専用 Organization で手動。失敗したら revert | 未 |

### 8.1b 権限総当たりテストの設計（`scripts/permission-matrix.ts`・D-0）

| 項目 | 仕様 |
|---|---|
| 対象環境 | 本番（Q-6 決定: staging は作らない）。`Organization` を2社 seed する（名前 `__test-org-a` / `__test-org-b`、`slug` `test-a` / `test-b`）。顧客は各社1件（氏名「テスト太郎」、メール `test-a@example.com`、電話なし）。**実在の個人情報は入れない** |
| ユーザー | A社の一般ユーザー、B社の一般ユーザー、staff（両社に `StaffOrgAccess`）の3人。Supabase のテストアカウントを3つ用意し、メール/パスワードでログインしてセッション Cookie を取る（`/api/auth/callback` 経由） |
| 実行 | §3 の表の各行について、3ユーザー×（自社の顧客ID／他社の顧客ID）で呼び、期待値（自社 200・他社 403・未ログイン 401 または 307）と照合。書き込み系は本文に `"__test": true` を付け、テスト後に作成物を削除 |
| 判定 | 1件でも期待外なら失敗。結果は表（route × ユーザー × 対象 → 実際のステータス）で出力し、CI（GitHub Actions・毎晩）で実行。失敗は Slack `#900_dev_monitoring` へ |
| 後片付け | テスト組織のデータは毎回削除。テスト組織自体は残す（`isTest=true`・M-13。横断 inbox と集計から除外） |

### 8.2 フェーズごとの受け入れ条件

**D-0（仕様の前提整備）**
- [ ] M-1 agentState 移行完了。memo にマーカー文字列が残っていない（SQL で 0 件）
- [ ] M-2 / M-4 / M-5 適用済み
- [ ] §3 の ⚠ をすべて ✅ に（監査ログ・`verifySharedSecret` 統一・preference の所属チェック・staff の管理者限定）
- [ ] 権限総当たりテストが CI で通る
- [ ] 変数置換の1本化（`lib/template-vars.ts`）
- [ ] 復旧手順書と PITR 確認

**D-1（1社目＝フラットエージェンシーを本番運用）**
- [ ] F-1〜F-12・F-17 の MUST が揃う
- [ ] M-3 OrganizationChannel で会社の LINE 公式・送信元を設定できる
- [ ] M-6 承認制セルフ予約
- [ ] §5 のドライラン→取り込み→並行稼働2週間を完了し、切替後1週間で「送信事故 0 件・未対応滞留 24h 超 0 件」

**D-2（5社）**
- [ ] 会社追加が「設定画面 ＋ ポータル通知先の変更」だけで完了する（コード変更なし）
- [ ] M-7 で Organization.store* を削除
- [ ] 横断レポート（§4.1）

**D-3（42社）**
- [ ] 横断 inbox が 42社×数千件で 2秒以内（M-5 のインデックス）
- [ ] 依存メジャーアップ（A-1）完了
- [ ] 保持期間の自動匿名化が動いている

---

## 10. 画面仕様（実装者向け・D-1 で揃える画面）

共通: 白基調＋ゴールド `#d4a017`、Noto Sans JP。情報カードは縦1列（横並び禁止。KPI タイルのみ例外）。ホバー色 `#006CB8`。エラーは画面上部に赤帯、成功は右下トースト。全画面に「↑更新」は不要（Web のため）。

| 画面 | 目的 | 主な要素 | 操作 | 権限 |
|---|---|---|---|---|
| `/inbox` 横断ダッシュボード | 未対応を漏らさず捌く | 左: 要対応／すべて／ステータス（自社時）／タグ／会社・店舗の切替（staff）。中央: 顧客行（未対応バッジ・会社/店舗・反響元・最終メッセージ・下書き承認待ち・未確定予約・担当者）。ページャ | 行クリック→詳細（右パネル）。承認待ちバッジ→承認画面 | S（staff は横断） |
| `/customers/[id]` 詳細 | 1顧客の対応 | 上: 氏名・ステータス・タグ・担当・店舗・ロック表示（「○○さんが対応中」）。中: 会話タイムライン（全チャンネル時系列、下書きは黄色枠に承認/却下/編集）。下: 送信パネル（チャンネルタブ、定型文、変数、SMS 分割数、NG 表現警告、送信）。右: 希望条件・対応記録・予定（未確定予約に「連絡済み・確定」）・店舗振り分けの推奨と適用 | 送信／承認／却下／タグ／ステータス変更／担当変更／予定の確定 | Sc |
| `/customers` 一覧 | 検索・絞り込み | 検索（氏名・電話・メール・物件名）、ステータス・タグ・反響元・担当・期間の絞り込み、CSV 出力（個人情報のためダウンロードは監査ログ） | 行クリック→詳細 | S |
| `/settings/status` | 会社のステータス定義 | 名前・色・順序・横断カテゴリ（NEW 必須の警告） | 追加／編集／削除／並べ替え | Sa |
| `/settings/templates` | 定型文 | カテゴリ・チャンネル・件名・本文・変数の挿入ボタン・プレビュー | CRUD | S（削除は Sa） |
| `/settings/workflow` | 追客ワークフロー | ステップ（日数・時刻・チャンネル・定型文・即時）。既定・有効の切替。停止条件の表示 | CRUD | Sa |
| `/settings/channels` | 外部連携（§6.1） | EMAIL / LINE / SMS カード、テスト送信、webhook URL | CRUD・疎通確認 | Sa |
| `/settings/stores` | 店舗と定休日（新設） | 店舗一覧（既定店舗）、定休日ルール（曜日／第n曜日／臨時休業）、スケジュール連動（§6.2 の provider 設定） | CRUD | Sa |
| `/settings/staff` | ユーザー | 名前・メール・役割・全社アクセス（staff） | 追加／編集（監査ログ） | Sa |
| `/settings/organization` | 会社設定 | 会社名・slug（表示のみ）・住所・免許番号・自動返信モード（DRAFT_ONLY / AUTO_SEND） | 編集（監査ログ） | Sa |
| `/analytics` | レポート（§4.1） | 期間・会社・店舗・反響元、5指標、3つの表 | 絞り込み | S（staff は横断） |
| `/visit/[orgId]`（公開） | 来店セルフ予約 | 日付・時間（連動ありは空きのみ表示）、氏名・電話・メール・来店方法・要望。受付後の文言は §2.5 の2方式で変える | 送信 | P（レート制限） |

## 9. 未決事項（Itaru の判断が要るもの）

| # | 論点 | 選択肢 | 推奨 |
|---|---|---|---|
| Q-1 | 個人情報の保持期間 | A: 最終接触から2年で匿名化 / B: 3年 / C: 期限なし（削除依頼のみ） | **決定（2026-09-05 Itaru）: 最終接触から5年で匿名化**（宅建業法の帳簿保存と揃える） |
| Q-2 | 会社ごとの LINE 公式 | A: 各社が自社の LINE 公式を持ち込む / B: ヘヤクレス名義の LINE を会社別に作る | **決定: A**（各社持ち込み。契約者は各社、接続情報の登録・管理はヘヤクレス） |
| Q-3 | Organization.slug の値 | 会社の英字コード（例 flat-agency） | **決定: マニュアルBの会社コードと同じ値**（`heyacules-manual-b` の `data/<code>.yaml` の code） |
| Q-4 | staff 付与の権限 | A: 管理者のみ / B: 管理者＋ Itaru の承認 | **決定: A**（監査ログで追う） |
| Q-5 | セルフ予約の確定方法 | （旧: 承認 SLA 30分/60分） | **決定（2026-09-05 Itaru）: 承認期限は設けない。店舗スケジュール連動あり＝空いていれば即時確定、連動なし＝未確定で受け付け、担当者の連絡をもって確定**（§2.5） |
| Q-7 | 店舗スケジュール連動の連動先 | （旧: Google / 自前 / 両方） | **決定（2026-09-05 Itaru）: 連動先は Google カレンダー・サイボウズ・TimeTree・カナリークラウド内のスケジュール管理の4つ**。実装順と可否は §6.2 |
| Q-6 | staging 環境 | A: Neon ブランチ＋Vercel Preview / B: 作らない | **決定: B（作らない）**。検証は本番で行い、失敗したら revert。権限総当たりテストは本番に「テスト専用 Organization 2社」を seed して API を叩く（個人情報は入れない） |

---

## 実施状況

- **2026-09-05 D-0 第1弾（PR #30）**: M-1（`Customer.agentState` 追加・cron/agent と webhook を状態列に切替・memo マーカー廃止・変換用 `/api/agent/migrate-agent-state`）、M-2（`LinePending.organizationId` の既定値廃止）、M-4（`AuditLog.organizationId`＋索引）、M-5（横断 inbox の索引）。§3 の ⚠ のうち `customers/preference`・`customers/[id]/duplicates` の所属チェック統一、`merge`・`staff`・`approve/reject` の監査ログ、`staff` の管理者限定、`agent/queue`・`cron/agent` の秘密鍵検証統一、公開予約ページのレート制限と phone 上書き廃止。承認送信で `FIRST_MAIL_DRAFTED→WAITING_REPLY`、`BOOKING_DRAFTED→BOOKED` に進める配線を追加。
- 残り（D-0）: `statuses`・`hankyo`・`store-visit-settings`・`reminders`・`agent/*` 設定の監査ログ、`agent/context|send|notify`・`cron/workflow` の秘密鍵検証統一、変数置換の1本化、権限総当たりテスト、復旧手順書、Resend svix 署名検証。

## 変更履歴

- v1.0 2026-09-05: 初版。architecture-v2.md §10 のセキュリティ PR（#28）反映後の状態を「現状」として記載。
- v1.1 2026-09-05: D-0 第1弾の実施状況を追記。§2.4 の「Manual stop が STOPPED_BY_REPLY」は未修正。
- v1.2 2026-09-05: §9 の決定を反映（Q-1 5年、Q-2 A、Q-3 マニュアルB会社コード、Q-4 A、Q-6 B＝staging なし・本番のテスト専用組織で検証）。Q-5 は説明中。
- v1.3 2026-09-05: Q-5 決定を反映。セルフ予約は「連動あり＝即時確定／連動なし＝担当者の連絡で確定」（§2.5・M-6）。店舗スケジュール連動 F-21・M-10 を追加。連動先は Q-7 として新設。
- v1.4 2026-09-05: Q-7 決定（連動先＝Google カレンダー・サイボウズ・TimeTree・カナリー内スケジュール）。§6.2 に連動先ごとの方式・可否・実装順を追加。
- v1.5 2026-09-05: 引き継ぎ文書で「薄い」と挙げた箇所を埋めた。§4.1 レポート画面、§4.2 会社別振り分けルール（正本＝マニュアルB YAML）、§4.3 タグ、§5.2b 移行スクリプト設計、§6.1 外部連携の設定画面と移行、§8.1b 権限総当たりテスト設計、§10 画面仕様。M-11〜M-13 追加。
