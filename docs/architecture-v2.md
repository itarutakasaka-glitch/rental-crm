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
- [ ] DRAFT_ONLY時の下書き生成（Message status=PENDING → /inboxに「承認待ち」表示 → 人が確認して送信）
- [ ] エラーSlack通知
- [ ] prisma migrate正規化
- [ ] StoreRoutingPanelの結果保存（storeId書き込み＋タグ付与）
- [ ] テンプレート3重構造の整理

### Phase C：2社目を入れる（真の多テナント化）
- [ ] Organization.slug＋宛先ルーティング（§4）
- [ ] 共通ステータス層（横断集計用のシステムステータス＋会社別表示名）
- [ ] staff管理UI（isStaff/StaffOrgAccessの画面）
- [ ] 二重対応防止ロック・「未対応最上位固定」ソート・横断クエリのページング

### Phase D：カナリー置換の本丸
- [ ] 42社の段階移行（1社ずつ並行稼働→検証→切替）
- [ ] タグ体系・追客ワークフロー高度化（TEL×LINE 14〜15ステップ）
- [ ] 一斉送信の横断対応・intentCategory自動分類の本稼働
