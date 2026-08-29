import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

// 2026-08-29: SupabaseからNeonへのDB移行・データコピー(一回限り)。
// スキーマはmigrate-neon-initで作成済み。ここではSUPABASE_DATABASE_URL_BACKUP(旧接続)から
// 現行DB(Neon)へ、依存関係の順にテーブルを丸ごとコピーする。
// 旧DB(Supabase)は過去のschema.prisma変更で実カラムがドリフトしている(schema.prismaに
// 無いカラムが残っている等)ため、コピー先(Neon)の実カラム一覧を information_schema から
// 取得し、その交差だけをINSERTする。enum型カラムは明示キャストする。

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

type ColInfo = { column_name: string; data_type: string; udt_name: string };

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-agent-secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const backupUrl = process.env.SUPABASE_DATABASE_URL_BACKUP;
  if (!backupUrl) return NextResponse.json({ error: "SUPABASE_DATABASE_URL_BACKUP not set" }, { status: 400 });

  const oldDb = new PrismaClient({ datasources: { db: { url: backupUrl } } });
  const newDb = new PrismaClient(); // 現行DATABASE_URL = Neon

  const report: Record<string, any> = {};
  try {
    for (const table of TABLES_IN_ORDER) {
      try {
        const targetCols: ColInfo[] = await newDb.$queryRawUnsafe(
          `SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = $1`,
          table
        );
        const targetColMap = new Map(targetCols.map((c) => [c.column_name, c]));

        const rows: any[] = await oldDb.$queryRawUnsafe(`SELECT * FROM "${table}"`);
        let inserted = 0;
        const errors: string[] = [];
        for (const row of rows) {
          const cols = Object.keys(row).filter((c) => targetColMap.has(c));
          if (cols.length === 0) continue;
          const values = cols.map((c) => row[c]);
          const placeholders = cols.map((c, i) => {
            const info = targetColMap.get(c)!;
            return info.data_type === "USER-DEFINED" ? `$${i + 1}::"${info.udt_name}"` : `$${i + 1}`;
          }).join(", ");
          const colList = cols.map((c) => `"${c}"`).join(", ");
          try {
            await newDb.$executeRawUnsafe(
              `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
              ...values
            );
            inserted++;
          } catch (e: any) {
            errors.push(String(e.message).slice(0, 150));
          }
        }
        report[table] = { total: rows.length, inserted, errors: errors.slice(0, 3) };
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
