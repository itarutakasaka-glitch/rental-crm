# 不動産賃貸仲介CRM

反響メール自動取込、LINE/SMS/メール統合送信、追客ワークフロー自動実行、メール開封トラッキング、カレンダー、分析ダッシュボードを搭載した賃貸仲介向けCRM。

## クイックスタート
```bash
npm install
cp .env.example .env.local  # Supabase/Resend情報を入力
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```
→ http://localhost:3000

詳細なデプロイ手順は **DEPLOY-GUIDE.md** を参照してください。

## 技術スタック
Next.js 15 / React 19 / TypeScript / Prisma 6 / PostgreSQL (Supabase) / Supabase Auth / Resend / LINE Messaging API / Twilio (SMS) / Tailwind CSS / Zod
