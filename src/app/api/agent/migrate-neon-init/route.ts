import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { readFileSync } from "fs";
import { join } from "path";

// 2026-08-29: SupabaseからNeonへのDB移行用・一回限りの初期化エンドポイント。
// prisma/neon-init.sql (prisma migrate diff --from-empty で生成した全スキーマ) を
// 空のNeon DBに対して順次実行する。db push/migrateがこのプロジェクトのCLI実行環境から
// DB接続できない問題の回避策(store-hierarchy-design.md参照)。
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-agent-secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sqlPath = join(process.cwd(), "prisma", "neon-init.sql");
    const sql = readFileSync(sqlPath, "utf8");
    // コメント行(-- ...)を除去してから、セミコロンで文単位に分割する
    // (Prisma生成SQLはCREATE TABLE内、PRIMARY KEY制約の前に空行を挟むため
    //  空行区切りでは1文が分断される)
    const withoutComments = sql.replace(/^--.*$/gm, "");
    const statements = withoutComments
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    let executed = 0;
    const errors: string[] = [];
    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
        executed++;
      } catch (e: any) {
        errors.push(`${stmt.slice(0, 60)}... -> ${e.message}`);
      }
    }

    return NextResponse.json({ success: errors.length === 0, executed, total: statements.length, errors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
