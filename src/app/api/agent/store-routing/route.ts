import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDrafts } from "@/lib/store-routing/flat-agency-drafts";
import type { RouterInput } from "@/lib/store-routing/flat-agency-router";

// inquiry-agent(対応店舗判断エージェント)のCRM組み込み版・第一弾。
// 現状はフラットエージェンシー固有ロジックのみ(store-hierarchy-design.md参照)。
// 出力は「推奨」であり、送信・タグ付けは人間が確認して行う(Phase1=下書き承認方式)。
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const 反響: RouterInput = body.反響 || {};
    const customer = body.customer || { name: "" };
    const dateStr: string = body.dateStr || new Date().toISOString().slice(0, 10);

    const result = generateDrafts({ 反響, customer, dateStr });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
