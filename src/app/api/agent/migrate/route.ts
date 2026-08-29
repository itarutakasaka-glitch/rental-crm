import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-agent-secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AgentTemplate" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "organizationId" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AgentTemplate_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "AgentTemplate_organizationId_key_key" UNIQUE ("organizationId", "key")
      );
    `);

    // Add new Organization columns if missing
    await prisma.$executeRawUnsafe(`ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "storeWebsite" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "storeClosedDays" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "storeParking" TEXT`);
    
    // Set initial values for our org
    const org = await prisma.organization.findFirst();
    if (org) {
      await prisma.$executeRawUnsafe(`UPDATE "Organization" SET 
        "storeAccess" = COALESCE("storeAccess", $1),
        "storeWebsite" = COALESCE("storeWebsite", $2),
        "storeClosedDays" = COALESCE("storeClosedDays", $3),
        "storeParking" = COALESCE("storeParking", $4),
        "storeHours" = COALESCE("storeHours", $5)
        WHERE "id" = $6`,
        '京王電鉄相模原線京王多摩センター駅 徒歩4分',
        'https://www.apamanshop.com/shop/13032804/',
        '火曜日、水曜日（1,2,3月は水曜日、第1第3火曜日定休日）',
        '駐車場のご用意がございますので事前にご連絡下さい',
        '09:30～18:30',
        org.id
      );
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "InitialCostRule" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "organizationId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "deposit" TEXT,
        "keyMoney" TEXT,
        "brokerageFee" TEXT,
        "insuranceFee" TEXT,
        "lockChangeFee" TEXT,
        "guaranteeFee" TEXT,
        "cleaningFee" TEXT,
        "otherFees" TEXT,
        "advanceRent" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InitialCostRule_pkey" PRIMARY KEY ("id")
      );
    `);

    // 2026-08-29: Store階層+全社ダッシュボード+意図分類 (store-hierarchy-design.md)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "autoReplyMode" TEXT NOT NULL DEFAULT 'DRAFT_ONLY'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isStaff" BOOLEAN NOT NULL DEFAULT false`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "desireSignalDetectedAt" TIMESTAMP(3)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "hasCustomerReplied" BOOLEAN NOT NULL DEFAULT false`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "isBookingConfirmed" BOOLEAN NOT NULL DEFAULT false`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "storeId" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "InquiryProperty" ADD COLUMN IF NOT EXISTS "vacancyStatus" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "intentCategory" TEXT`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Store" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "organizationId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "phone" TEXT,
        "address" TEXT,
        "storeHours" TEXT,
        "storeAccess" TEXT,
        "storeParking" TEXT,
        "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
        "autoReplySubject" TEXT NOT NULL DEFAULT '',
        "autoReplyTemplate" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Store_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Store_organizationId_slug_key" UNIQUE ("organizationId", "slug")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StoreClosedDayRule" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "storeId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "weekday" INTEGER,
        "nth" INTEGER,
        "includeHolidays" BOOLEAN NOT NULL DEFAULT false,
        "startDate" DATE,
        "endDate" DATE,
        "note" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StoreClosedDayRule_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StaffOrgAccess" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "userId" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StaffOrgAccess_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "StaffOrgAccess_userId_organizationId_key" UNIQUE ("userId", "organizationId")
      );
    `);

    // FK制約はIF NOT EXISTSが無いのでDO $$ ... EXCEPTIONで冪等化
    const fks: [string, string][] = [
      ["Store", `ALTER TABLE "Store" ADD CONSTRAINT "Store_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
      ["StoreClosedDayRule", `ALTER TABLE "StoreClosedDayRule" ADD CONSTRAINT "StoreClosedDayRule_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
      ["StaffOrgAccess_user", `ALTER TABLE "StaffOrgAccess" ADD CONSTRAINT "StaffOrgAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
      ["StaffOrgAccess_org", `ALTER TABLE "StaffOrgAccess" ADD CONSTRAINT "StaffOrgAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`],
      ["Customer_store", `ALTER TABLE "Customer" ADD CONSTRAINT "Customer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE`],
    ];
    for (const [, sql] of fks) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (e: any) {
        if (!String(e.message).includes("already exists")) throw e;
      }
    }

    return NextResponse.json({ success: true, message: "Tables created" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
