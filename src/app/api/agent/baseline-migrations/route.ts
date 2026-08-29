import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// 2026-08-30: 一回限り。prisma migrateを正規に導入するためのベースライン作成。
// これまでDBスキーマは手動SQL(/api/agent/migrate*)で構築してきたため、
// _prisma_migrationsの履歴テーブルが存在しない。ここで
// 1) 標準の_prisma_migrationsテーブルを作成
// 2) 既に適用済みの現行スキーマ全体を"20260830000000_baseline"として
//    「適用済み」で記録する(実際にはCREATE TABLE等は実行しない。テーブルは既存のため)
// これ以降のスキーマ変更は prisma/migrations/ に新しいmigration.sqlを追加し、
// ビルド時の `prisma migrate deploy` で自動適用する(architecture-v2.md §5)。
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-agent-secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { checksum } = await req.json();
    if (!checksum) return NextResponse.json({ error: "checksum required" }, { status: 400 });

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) NOT NULL,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
      );
    `);

    const existing: any[] = await prisma.$queryRawUnsafe(
      `SELECT id FROM "_prisma_migrations" WHERE migration_name = $1`,
      "20260830000000_baseline"
    );
    if (existing.length > 0) {
      return NextResponse.json({ success: true, message: "already baselined", skipped: true });
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
       VALUES (gen_random_uuid()::text, $1, now(), $2, now(), 1)`,
      checksum,
      "20260830000000_baseline"
    );

    return NextResponse.json({ success: true, migration: "20260830000000_baseline" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
