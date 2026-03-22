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
