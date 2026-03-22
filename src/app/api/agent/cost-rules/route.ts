import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const org = await prisma.organization.findFirst();
    if (!org) return NextResponse.json({ rules: [] });
    const rules = await prisma.$queryRawUnsafe(
      `SELECT * FROM "InitialCostRule" WHERE "organizationId" = $1 ORDER BY "isDefault" DESC, "name" ASC`, org.id
    ) as any[];
    return NextResponse.json({ rules });
  } catch { return NextResponse.json({ rules: [] }); }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const org = await prisma.organization.findFirst();
    if (!org) return NextResponse.json({ error: "No org" }, { status: 400 });
    
    const { id, name, isDefault, deposit, keyMoney, brokerageFee, insuranceFee,
            lockChangeFee, guaranteeFee, cleaningFee, otherFees, advanceRent, notes } = body;
    
    if (id) {
      // Update existing
      await prisma.$executeRawUnsafe(
        `UPDATE "InitialCostRule" SET "name"=$1, "isDefault"=$2, "deposit"=$3, "keyMoney"=$4, "brokerageFee"=$5, "insuranceFee"=$6, "lockChangeFee"=$7, "guaranteeFee"=$8, "cleaningFee"=$9, "otherFees"=$10, "advanceRent"=$11, "notes"=$12, "updatedAt"=NOW() WHERE "id"=$13`,
        name, isDefault||false, deposit||null, keyMoney||null, brokerageFee||null, insuranceFee||null, lockChangeFee||null, guaranteeFee||null, cleaningFee||null, otherFees||null, advanceRent||null, notes||null, id
      );
    } else {
      // Create new
      await prisma.$executeRawUnsafe(
        `INSERT INTO "InitialCostRule" ("id","organizationId","name","isDefault","deposit","keyMoney","brokerageFee","insuranceFee","lockChangeFee","guaranteeFee","cleaningFee","otherFees","advanceRent","notes") VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        org.id, name, isDefault||false, deposit||null, keyMoney||null, brokerageFee||null, insuranceFee||null, lockChangeFee||null, guaranteeFee||null, cleaningFee||null, otherFees||null, advanceRent||null, notes||null
      );
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await prisma.$executeRawUnsafe(`DELETE FROM "InitialCostRule" WHERE "id"=$1`, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
