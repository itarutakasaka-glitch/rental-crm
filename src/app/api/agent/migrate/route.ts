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

    return NextResponse.json({ success: true, message: "Tables created" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
