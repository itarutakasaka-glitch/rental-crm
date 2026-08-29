import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// architecture-v2.md §8 Step2: cron/agent.ts内にハードコードされていたFALLBACK_TEMPLATES/
// CONFIRM_FALLBACKをAgentTemplateへ複製する。これにより/agent/flow画面から編集可能になる。
// 冪等: 既にkeyが存在する組織には何もしない(コード側のフォールバック定数はそのまま残すので、
// このseedを実行しなくても既存動作に影響は無い)。
const SEED_TEMPLATES: Record<string, string> = {
  tpl_tent_a:
    "{{customer_name}}様\n\nご連絡ありがとうございます。\n\n================================================\n※現時点でご予約は確定しておりませんので、ご注意ください\n================================================\n\nお問い合わせ物件は現在は入居中で内見できないお部屋ですので、外観・共用部のご案内や似ている物件のご紹介ができればと思います。\n\n{visit_proposal}に下記の店舗にてご予約できればと思うのですが、【お電話番号】を頂くこと可能でしょうか？\n\n{store_access}",
  tpl_tent_b:
    "{{customer_name}}様\n\nご連絡ありがとうございます。\n\n================================================\n※現時点でご予約は確定しておりませんので、ご注意ください\n================================================\n\nお問い合わせ物件は募集が終了しておりますので、ぜひ店頭で他のお部屋のご紹介ができればと思います。\n\n{visit_proposal}に下記の店舗にてご予約できればと思うのですが、【お電話番号】を頂くこと可能でしょうか？\n\n{store_access}",
  tpl_tent_c:
    "{{customer_name}}様\n\nご連絡ありがとうございます。\n\n================================================\n※現時点でご予約は確定しておりませんので、ご注意ください\n================================================\n\n当日は店頭でお話を伺い、お問い合わせ物件に加えて候補物件を洗い出して一気に回る流れでご案内できればと思います。\n\n{visit_proposal}に下記の店舗にてご予約できればと思うのですが、【お電話番号】を頂くこと可能でしょうか？\n\n{store_access}",
  tpl_tent_d:
    "{{customer_name}}様\n\nご連絡ありがとうございます。\n\n================================================\n※現時点でご予約は確定しておりませんので、ご注意ください\n================================================\n\nお問い合わせ物件は建築中で内見できないお部屋ですので、外観・現状のご案内や似ている物件のご紹介ができればと思います。\n\n{visit_proposal}に下記の店舗にてご予約できればと思うのですが、【お電話番号】を頂くこと可能でしょうか？\n\n{store_access}",
  tpl_confirm:
    "それでは{appointment_datetime}に下記の店舗にご予約いたします。\n\n{store_access}\n\nまた、来店時のご案内に際して\n\n【お電話番号】と下記【希望条件】をお知らせください。\n\n----------------------------------------------\n\n■希望条件\n\n・賃料：（　　）円まで\n\n・間取：（　　）\n\n・広さ：（　　）㎡以上\n\n・駐車場（　　）台希望\n\n・エリア：（　　）\n\n・駅から：（　　）分\n\n・入居人数：（　　）人\n\n・入居希望時期：（　年　月　日頃）\n\n・引っ越し理由（　　）\n\n・その他、こだわり条件（　　）\n\n----------------------------------------------\n\n■ご留意事項\n\n※ご案内当日までにお問い合わせ物件の募集が終了してしまう可能性もございます、その場合も近い条件でお部屋のご紹介をさせて頂きますので、ご安心ください\n\n※ご案内の際、鍵手配が必要です。状況によりご案内出来ない場合がございます、その際はご了承ください",
  // architecture-v2.md §8 Step4: flat-agency-drafts.tsにハードコードされていた外国語向け初回メールを移設。
  // {{customer_name}}が下書き生成時に顧客名へ置換される。tpl_foreign_generalは未整備(元実装も未使用)のため今回は入れない。
  tpl_mail_en:
    "Dear {{customer_name}},\n\nThank you very much for your inquiry to Flat Agency.\n\nWe would be happy to help you find a place to live. Could you please share a little more about what you are looking for?\n\n- Preferred area (train line, station, or school name)\n- Budget (maximum monthly rent)\n- Layout / size\n- Desired move-in date\n\nOnce we receive these details, we can suggest the most suitable properties for you.\nWe look forward to hearing from you.\n\nBest regards,\nFlat Agency",
  tpl_mail_zh:
    "{{customer_name}}您好，\n\n感谢您向Flat Agency咨询。\n\n我们很乐意帮您寻找合适的房源。能否请您告知以下信息？\n\n・希望的区域（沿线、车站或学校名称）\n・预算（每月租金上限）\n・户型／面积\n・希望入住时间\n\n收到后我们会为您推荐最合适的房源。\n期待您的回复。\n\nFlat Agency",
};

const TITLES: Record<string, string> = {
  tpl_tent_a: "来店ご案内(入居中・未確定)",
  tpl_tent_b: "来店ご案内(募集終了・未確定)",
  tpl_tent_c: "来店ご案内(通常・未確定)",
  tpl_tent_d: "来店ご案内(建築中・未確定)",
  tpl_confirm: "アポ確定",
  tpl_mail_en: "初回メール(英語)",
  tpl_mail_zh: "初回メール(中国語・要レビュー)",
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-agent-secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const org = await prisma.organization.findFirst();
    if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const created: string[] = [];
    for (const [key, body] of Object.entries(SEED_TEMPLATES)) {
      const existing = await (prisma as any).agentTemplate.findUnique({ where: { organizationId_key: { organizationId: org.id, key } } });
      if (existing) continue;
      await (prisma as any).agentTemplate.create({ data: { organizationId: org.id, key, title: TITLES[key] || key, body } });
      created.push(key);
    }

    return NextResponse.json({ success: true, created, skipped: Object.keys(SEED_TEMPLATES).filter((k) => !created.includes(k)) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
