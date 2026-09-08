-- implementation-spec-v1.md §4 F-8: 下書きの却下理由を残す。
-- 却下(人が送らないと決めた)と送信失敗(FAILED)を区別できるようにする。

ALTER TYPE "MessageStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE "Message" ADD COLUMN "rejectReason" TEXT;
ALTER TABLE "Message" ADD COLUMN "rejectedByUserId" TEXT;
ALTER TABLE "Message" ADD COLUMN "rejectedAt" TIMESTAMP(3);
