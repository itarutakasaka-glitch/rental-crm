# 復旧手順書（heyacules cloud）

implementation-spec-v1.md §7 の RPO 1時間以内 / RTO 4時間以内 を満たすための手順。
**障害時はまずここを開く。** 判断に迷ったら「壊れたものを直す」より「直前の正常な状態に戻す」を優先する。

すべての作業ログ・報告は Slack `#900_dev_monitoring` に Bot 名義で残す（個人メール宛は禁止）。時刻は JST で書く。

---

## 0. 最初の5分（切り分け）

| 確認 | コマンド / 場所 | 正常 |
|---|---|---|
| アプリが生きているか | `curl -s -o /dev/null -w "%{http_code}" https://tama-fudosan-crm-2026.vercel.app/login` | 200 |
| cron が生きているか | `curl -s https://tama-fudosan-crm-2026.vercel.app/api/cron/timeout-check -H "Authorization: Bearer $CRON_SECRET"` | `{"checked":n}` 200 |
| DB に届くか | `curl -s https://tama-fudosan-crm-2026.vercel.app/api/cron/agent -H "Authorization: Bearer $CRON_SECRET"` | `errorCount:0` 200 |
| 直近のデプロイ | Vercel ダッシュボード → tama-fudosan-crm-2026 → Deployments | 最新が Ready |
| 直近のエラー | Slack `#900_dev_monitoring` | 通知なし |

`CRON_SECRET` は `crm-project-new/.env.local`。

切り分けの分岐:
- **アプリは 200 だが DB 系が 500** → §2（DB 障害）
- **デプロイ直後から壊れた** → §1（コードを戻す）
- **データが消えた・壊れた** → §3（時点復元）
- **ログインできない** → §4（Supabase Auth）

---

## 1. コードを戻す（直前のデプロイに巻き戻す）— 目標 15分

原因がコードなら**調査より先に戻す**。

1. Vercel ダッシュボード → Deployments → 直前の Ready なデプロイ → **Promote to Production**
   （CLI: `npx vercel rollback <前の本番デプロイURL>`）
2. §0 のヘルスチェックを再実行して復旧を確認
3. GitHub で原因の PR を `git revert` して main に戻す（ダッシュボードの巻き戻しだけだと次のデプロイで再発する）

**注意**: `npx vercel redeploy <古いURL>` は本番をその古いビルドに巻き戻す。env を足した後の反映で使うと事故る（既知）。env 反映は「最新の本番デプロイ」を redeploy する。

**マイグレーションを含む PR を戻す場合**: コードを戻してもテーブルの変更は戻らない。列の追加は後方互換なのでそのままでよい。列の削除・型変更を戻す必要があるときは §3 の時点復元を使う（手で逆 SQL を当てない）。

---

## 2. DB 障害（Neon に届かない）— 目標 30分

1. Neon ダッシュボードでプロジェクトの状態を確認（Compute が suspended なら最初のクエリで自動復帰する）
2. 接続文字列が変わっていないか: Vercel の env `DATABASE_URL` / `DIRECT_URL` と Neon の値を突き合わせる
3. env を直したら **最新の本番デプロイを redeploy**（新しい env はデプロイし直さないと効かない）
4. それでも復旧しなければ Neon のサポート状況（ステータスページ）を確認し、Slack に「復旧見込み待ち」と記録

この間、反響は届き続けるがアプリに入らない。**Resend 側にメールは残る**ので、復旧後に再送してもらうか、webhook の再配信で取り込む。

---

## 3. データの時点復元（PITR）— 目標 4時間

**前提（S-3・未確認）**: Neon の履歴保持が 7日以上あること。**Itaru がダッシュボードで有効か確認する必要がある。**
確認場所: Neon → プロジェクト → Settings → Storage / History retention。

手順:
1. **止める**: Vercel の Cron を無効化（プロジェクト設定 → Cron Jobs）。書き込みが続くと復元点がずれる
2. Slack に「復元作業に入る。開始 HH:MM JST・対象時刻・理由」を投稿
3. Neon → Branches → **Create branch from a point in time**（壊れる直前の時刻を指定）
4. 新しいブランチの接続文字列を取得し、**別の一時 env で中身を確認**（件数・直近の顧客・メッセージが期待どおりか）
5. 問題なければ本番の `DATABASE_URL` / `DIRECT_URL` をそのブランチに切り替え → 最新の本番デプロイを redeploy
6. §0 のヘルスチェック → Cron を再有効化
7. **失われた区間の申し送り**: 復元点以降に届いた反響は消えている。Resend の受信履歴と各ポータルの通知メールから手で拾い直す。対象期間を Slack に明記する

**やらないこと**: 本番 DB に直接 `DELETE` / `UPDATE` を打って直す。原因が広がる。

---

## 4. ログインできない（Supabase Auth）

ログインだけ Supabase に残存依存している（**Supabase プロジェクトを削除しない**）。

1. Supabase ダッシュボードでプロジェクトが Active か
2. Vercel の env `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` が Supabase の値と一致するか
3. 直したら最新の本番デプロイを redeploy
4. 個別ユーザーだけ入れない場合は Supabase の Users で該当ユーザーの状態を確認（削除・パスワード変更は Itaru が操作する）

DB（Neon）と認証（Supabase）は別なので、**Supabase が落ちても顧客データは無事**。逆にログインできなくても cron と webhook は動き続ける。

---

## 5. 誤送信・誤操作からの復旧

| 事象 | 対応 |
|---|---|
| 顧客に誤った内容を送った | 送信は取り消せない。顧客詳細から訂正の連絡を送り、`CustomerRecord` に経緯を残す。Slack に報告 |
| 一斉送信を誤爆した | `AuditLog` の `message.broadcast` で件数・対象・実行者を特定（`organizationId` と `createdAt` で絞る）。対象顧客に訂正連絡 |
| 顧客を誤って統合（merge）した | `AuditLog` の `customer.merge` に削除側の氏名・連絡先が残っている。§3 の時点復元でしか完全には戻せないため、影響が小さければ手で作り直す |
| 誰かに誤って全社アクセスを与えた | `/settings/staff` で OFF（`StaffOrgAccess` が全削除される）。`AuditLog` の `staff.update` / `staff.grant` で誰がいつ付与したか追える |

---

## 6. 連絡と記録

- 障害の発生・復旧はすべて Slack `#900_dev_monitoring`（Bot 名義）
- 本文には「何が落ちたか特定できる情報」と「人手で何をすべきか」を書く
- 復旧後、原因と再発防止を `docs/architecture-v2.md` か `implementation-spec-v1.md` に追記する（口頭で終わらせない）

## 7. 未確認・宿題

- [ ] **S-3: Neon の PITR / 履歴保持日数（Itaru がダッシュボードで確認）**。7日未満なら RPO 1時間を満たせないので設定を上げる
- [ ] 復元の実地リハーサル（テスト用ブランチを作って §3 の 3〜4 を通す）。D-1 の前に1回やる
- [ ] Vercel Cron の一時停止手順のスクリーンショット（実際に止めたことがまだない）
