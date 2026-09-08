-- implementation-spec-v1.md §2.5 (M-6) / §6.2 (M-10)

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED');
CREATE TYPE "ConfirmedBy" AS ENUM ('SCHEDULE_LINK', 'STAFF_CONTACT');
CREATE TYPE "ScheduleProvider" AS ENUM ('INTERNAL', 'GOOGLE_CALENDAR', 'CYBOZU', 'TIMETREE', 'CANARY');

-- StoreVisitBooking.status を文字列から enum へ。
-- 既存値は 'PENDING'/'CONFIRMED'/'REJECTED'/'CANCELLED' のいずれかを想定するが、
-- 想定外の値があっても移行が落ちないよう PENDING に寄せる（勝手に確定にはしない）。
ALTER TABLE "StoreVisitBooking" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "StoreVisitBooking"
  ALTER COLUMN "status" TYPE "BookingStatus"
  USING (CASE upper("status")
    WHEN 'CONFIRMED' THEN 'CONFIRMED'
    WHEN 'REJECTED'  THEN 'REJECTED'
    WHEN 'CANCELLED' THEN 'CANCELLED'
    WHEN 'CANCELED'  THEN 'CANCELLED'
    ELSE 'PENDING'
  END)::"BookingStatus";
ALTER TABLE "StoreVisitBooking" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "StoreVisitBooking" ADD COLUMN "storeId" TEXT;
ALTER TABLE "StoreVisitBooking" ADD COLUMN "confirmedBy" "ConfirmedBy";
ALTER TABLE "StoreVisitBooking" ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "StoreVisitBooking" ADD COLUMN "confirmedByUserId" TEXT;
ALTER TABLE "StoreVisitBooking" ADD COLUMN "rejectReason" TEXT;
ALTER TABLE "StoreVisitBooking" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 既に CONFIRMED になっている予約は、旧仕様（自動確定）で確定したもの。
-- 担当者の連絡で確定した扱いにしておく（連動で確定したものと区別する）。
UPDATE "StoreVisitBooking"
  SET "confirmedBy" = 'STAFF_CONTACT', "confirmedAt" = "createdAt"
  WHERE "status" = 'CONFIRMED' AND "confirmedBy" IS NULL;

-- CreateIndex
CREATE INDEX "StoreVisitBooking_organizationId_status_visitDate_idx"
  ON "StoreVisitBooking"("organizationId", "status", "visitDate");

-- AddForeignKey
ALTER TABLE "StoreVisitBooking" ADD CONSTRAINT "StoreVisitBooking_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreVisitBooking" ADD CONSTRAINT "StoreVisitBooking_confirmedByUserId_fkey"
  FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "StoreScheduleLink" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "provider" "ScheduleProvider" NOT NULL DEFAULT 'INTERNAL',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "calendarId" TEXT,
    "secretEnc" TEXT,
    "slotMinutes" INTEGER NOT NULL DEFAULT 60,
    "hoursStart" TEXT,
    "hoursEnd" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreScheduleLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreScheduleLink_storeId_key" ON "StoreScheduleLink"("storeId");

-- AddForeignKey
ALTER TABLE "StoreScheduleLink" ADD CONSTRAINT "StoreScheduleLink_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
