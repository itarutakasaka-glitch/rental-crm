# 不動産CRM — 公開・運用ガイド

## 全体の流れ (約2~3時間)

1. アカウント準備 → GitHub / Supabase / Vercel / Resend
2. DB構築 → Supabase でプロジェクト作成 + prisma db push
3. デプロイ → Vercel にインポート + 環境変数
4. 認証設定 → Supabase Auth リダイレクトURL
5. メール設定 → Resend ドメイン認証
6. 動作確認

## Step 1: Supabase (DB + 認証)
1. https://supabase.com → GitHubでサインアップ
2. New Project → 名前: rental-crm / リージョン: Tokyo
3. Settings > API からURL + anon key をメモ
4. Settings > Database > Connection string をメモ

## Step 2: ローカルでDB構築
```bash
cp .env.example .env.local
# DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY を入力
npx prisma db push
npx tsx prisma/seed.ts
```

## Step 3: Vercel デプロイ
1. https://vercel.com → GitHubでサインアップ
2. Add New > Project → GitHubリポジトリ選択
3. Environment Variables に5つ設定:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - DATABASE_URL
   - RESEND_API_KEY
   - CRON_SECRET (任意の文字列)
4. Deploy

## Step 4: Supabase Auth 設定
1. Authentication > URL Configuration
2. Site URL: https://あなた.vercel.app
3. Redirect URLs: https://あなた.vercel.app/api/auth/callback

## Step 5: Resend (メール送信)
1. https://resend.com → サインアップ
2. API Keys > Create → RESEND_API_KEY を Vercel に追加
3. Domains > ドメイン認証 (DNS設定)

## Step 6: 動作確認
- [ ] /login でログイン可能
- [ ] 顧客一覧表示
- [ ] カレンダー表示
- [ ] 分析ダッシュボード表示
- [ ] 設定画面のCRUD

## 費用目安
| サービス | 無料プラン | 有料 (推奨) |
|---------|-----------|------------|
| Supabase | DB 500MB | Pro $25/月 |
| Vercel | Cron 1日1回 | Pro $20/月 |
| Resend | 100通/月 | Pro $20/月 |
| **合計** | **$0** | **$65/月~** |
