import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthUserForAction } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const rules = await prisma.$queryRawUnsafe(
      `SELECT * FROM "InitialCostRule" WHERE "organizationId" = $1 ORDER BY "isDefault" DESC, "name" ASC`, user.organizationId
    ) as any[];
    return NextResponse.json({ rules });
  } catch { return NextResponse.json({ rules: [] }); }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();

    const { id, name, isDefault, deposit, keyMoney, brokerageFee, insuranceFee,
            lockChangeFee, guaranteeFee, cleaningFee, otherFees, advanceRent, notes } = body;

    if (id) {
      // Update existing (organizationIdでスコープ、他社のレコードは更新不可)
      await prisma.$executeRawUnsafe(
        `UPDATE "InitialCostRule" SET "name"=$1, "isDefault"=$2, "deposit"=$3, "keyMoney"=$4, "brokerageFee"=$5, "insuranceFee"=$6, "lockChangeFee"=$7, "guaranteeFee"=$8, "cleaningFee"=$9, "otherFees"=$10, "advanceRent"=$11, "notes"=$12, "updatedAt"=NOW() WHERE "id"=$13 AND "organizationId"=$14`,
        name, isDefault||false, deposit||null, keyMoney||null, brokerageFee||null, insuranceFee||null, lockChangeFee||null, guaranteeFee||null, cleaningFee||null, otherFees||null, advanceRent||null, notes||null, id, user.organizationId
      );
    } else {
      // Create new
      await prisma.$executeRawUnsafe(
        `INSERT INTO "InitialCostRule" ("id","organizationId","name","isDefault","deposit","keyMoney","brokerageFee","insuranceFee","lockChangeFee","guaranteeFee","cleaningFee","otherFees","advanceRent","notes") VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        user.organizationId, name, isDefault||false, deposit||null, keyMoney||null, brokerageFee||null, insuranceFee||null, lockChangeFee||null, guaranteeFee||null, cleaningFee||null, otherFees||null, advanceRent||null, notes||null
      );
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUserForAction();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await req.json();
    // organizationIdでスコープ(他社のレコードは削除不可)
    await prisma.$executeRawUnsafe(`DELETE FROM "InitialCostRule" WHERE "id"=$1 AND "organizationId"=$2`, id, user.organizationId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
