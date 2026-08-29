import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

// 2026-08-29: SupabaseからNeonへのDB移行・データコピー(一回限り)。
// スキーマはmigrate-neon-initで作成済み。ここではSUPABASE_DATABASE_URL_BACKUP(旧接続)から
// 現行DB(Neon)へ、依存関係の順にテーブルを丸ごとコピーする。
// 件数がごく少ない(実質未運用)ことを前提にした単純な実装。

const TABLES_IN_ORDER = [
  "Organization",
  "User",
  "Status",
  "Store",
  "StaffOrgAccess",
  "StoreClosedDayRule",
  "TemplateCategory",
  "Template",
  "Workflow",
  "WorkflowStep",
  "Property",
  "StoreVisitSetting",
  "VisitReminder",
  "AgentTemplate",
  "InitialCostRule",
  "LinePending",
  "Customer",
  "CustomerTag",
  "InquiryProperty",
  "WishCondition",
  "Message",
  "MessageEvent",
  "Schedule",
  "StoreVisitBooking",
  "WorkflowRun",
  "WorkflowStepRun",
  "CustomerRecord",
  "CustomerPreference",
  "StatusHistory",
  "AuditLog",
];

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-agent-secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const backupUrl = process.env.SUPABASE_DATABASE_URL_BACKUP;
  if (!backupUrl) return NextResponse.json({ error: "SUPABASE_DATABASE_URL_BACKUP not set" }, { status: 400 });

  const oldDb = new PrismaClient({ datasources: { db: { url: backupUrl } } });
  const newDb = new PrismaClient(); // 現行DATABASE_URL = Neon

  const report: Record<string, number | string> = {};
  try {
    for (const table of TABLES_IN_ORDER) {
      try {
        const rows: any[] = await oldDb.$queryRawUnsafe(`SELECT * FROM "${table}"`);
        let inserted = 0;
        for (const row of rows) {
          const cols = Object.keys(row);
          const values = cols.map((c) => row[c]);
          const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
          const colList = cols.map((c) => `"${c}"`).join(", ");
          try {
            await newDb.$executeRawUnsafe(
              `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
              ...values
            );
            inserted++;
          } catch (e: any) {
            report[`${table}_row_error`] = String(e.message).slice(0, 200);
          }
        }
        report[table] = inserted;
      } catch (e: any) {
        report[table] = `error: ${e.message}`.slice(0, 200);
      }
    }
    return NextResponse.json({ success: true, report });
  } finally {
    await oldDb.$disconnect();
    await newDb.$disconnect();
  }
}
