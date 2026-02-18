import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // 組織
  const org = await prisma.organization.create({ data: { name: "アパマンショップ多摩センター店", phone: "042-123-4567", email: "info@apaman-tama.jp", address: "東京都多摩市落合1-1-1" } });

  // ユーザー
  const user = await prisma.user.create({ data: { organizationId: org.id, email: "yoshida@apaman-tama.jp", name: "吉田", role: "ADMIN" } });

  // ステータス
  const statusData = [
    { name: "新規対応", color: "#ef4444", order: 1, isDefault: true },
    { name: "初期対応済", color: "#f97316", order: 2 },
    { name: "返信無し", color: "#eab308", order: 3 },
    { name: "追客中", color: "#3b82f6", order: 4 },
    { name: "来店予約", color: "#8b5cf6", order: 5 },
    { name: "来店済", color: "#6366f1", order: 6 },
    { name: "申込前", color: "#10b981", order: 7 },
    { name: "完了", color: "#6b7280", order: 8 },
    { name: "長期追客", color: "#06b6d4", order: 9 },
    { name: "休止", color: "#94a3b8", order: 10 },
    { name: "失注", color: "#cbd5e1", order: 11 },
  ];
  const statuses: Record<string, any> = {};
  for (const s of statusData) {
    statuses[s.name] = await prisma.status.create({ data: { organizationId: org.id, ...s } });
  }

  // テンプレートカテゴリ
  const cat1 = await prisma.templateCategory.create({ data: { organizationId: org.id, name: "初期対応", order: 1 } });
  const cat2 = await prisma.templateCategory.create({ data: { organizationId: org.id, name: "追客", order: 2 } });

  // テンプレート
  const tpl1 = await prisma.template.create({
    data: { organizationId: org.id, categoryId: cat1.id, name: "初回返信メール", channel: "EMAIL",
      subject: "【アパマンショップ多摩センター店】お問い合わせありがとうございます",
      body: "{顧客名}様\n\nこの度はお問い合わせいただき、誠にありがとうございます。\nアパマンショップ多摩センター店の{担当者名}が担当させていただきます。\n\nお問い合わせいただいた物件について、最新の空室状況を確認のうえ、改めてご連絡させていただきます。\n\n─────────────────\nアパマンショップ多摩センター店\n吉田 TEL: 042-123-4567\n─────────────────" },
  });
  const tpl2 = await prisma.template.create({
    data: { organizationId: org.id, categoryId: cat2.id, name: "追客メール1通目", channel: "EMAIL",
      subject: "【アパマンショップ多摩センター店】物件の空室状況のご連絡",
      body: "{顧客名}様\n\nお世話になっております。吉田です。\n先日お問い合わせいただいた物件について確認が取れましたのでご連絡いたします。\nご来店・オンライン相談も承っております。" },
  });

  // ワークフロー
  const wf = await prisma.workflow.create({ data: { organizationId: org.id, name: "デフォルト追客フロー", isDefault: true, isActive: true } });
  await prisma.workflowStep.create({ data: { workflowId: wf.id, name: "初回返信メール", daysAfter: 0, timeOfDay: "即時", channel: "EMAIL", templateId: tpl1.id, order: 1 } });
  await prisma.workflowStep.create({ data: { workflowId: wf.id, name: "追客メール①", daysAfter: 1, timeOfDay: "10:00", channel: "EMAIL", templateId: tpl2.id, order: 2 } });

  // サンプル顧客
  const cust1 = await prisma.customer.create({
    data: { organizationId: org.id, name: "瀬戸泉", email: "giabbit.izumi@iCloud.com", phone: "090-4327-1424", preferredContact: "電話", sourcePortal: "アパマンショップ",
      statusId: statuses["新規対応"].id, assigneeId: user.id, isNeedAction: true, lastActiveAt: new Date() },
  });
  await prisma.inquiryProperty.create({ data: { customerId: cust1.id, name: "ビレッジハウス小比企5号棟", address: "東京都八王子市小比企町", station: "多摩モノレール/山田駅", roomNumber: "205号室", rent: 61100, area: 49.2, layout: "2DK" } });
  await prisma.customerTag.create({ data: { customerId: cust1.id, name: "アパマン反響" } });
  await prisma.message.create({ data: { customerId: cust1.id, direction: "INBOUND", channel: "EMAIL", subject: "空室確認", body: "最新の空室状況を知りたい", status: "SENT" } });

  const cust2 = await prisma.customer.create({
    data: { organizationId: org.id, name: "赤星", email: "tommygatta@yahoo.co.jp", phone: "080-1043-2464", preferredContact: "メール", sourcePortal: "SUUMO",
      statusId: statuses["初期対応済"].id, assigneeId: user.id, isNeedAction: false, lastActiveAt: new Date(Date.now() - 86400000) },
  });
  await prisma.inquiryProperty.create({ data: { customerId: cust2.id, name: "鹿島団地2号棟408", address: "東京都八王子市鹿島", station: "多摩都市モノレール/松が谷", rent: 92000, area: 52.58, layout: "2LDK", portalUrl: "https://suumo.jp/chintai/bc_100489123435/" } });
  await prisma.customerTag.create({ data: { customerId: cust2.id, name: "SUUMO反響" } });
  await prisma.message.create({ data: { customerId: cust2.id, direction: "INBOUND", channel: "EMAIL", subject: "お問い合わせ", body: "この部屋に関して詳しく教えて欲しい", status: "SENT" } });
  await prisma.message.create({ data: { customerId: cust2.id, senderId: user.id, direction: "OUTBOUND", channel: "EMAIL", subject: "【アパマンショップ多摩センター店】お問い合わせありがとうございます", body: "赤星様\n\nこの度はお問い合わせいただき、誠にありがとうございます。\nアパマンショップ多摩センター店の吉田が担当させていただきます。\n\n鹿島団地2号棟408について、現在空室でご案内可能です。\n\nご来店・オンライン相談も承っております。", status: "SENT", openedAt: new Date(Date.now() - 43200000), openCount: 2 } });

  // サンプルスケジュール
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(14, 0, 0, 0);
  const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2); dayAfter.setHours(10, 0, 0, 0);
  await prisma.schedule.create({ data: { organizationId: org.id, userId: user.id, customerId: cust1.id, title: "瀬戸様 架電フォロー", type: "CALL", startAt: tomorrow, endAt: new Date(tomorrow.getTime() + 30 * 60000), color: "#f59e0b" } });
  await prisma.schedule.create({ data: { organizationId: org.id, userId: user.id, customerId: cust2.id, title: "赤星様 来店", type: "VISIT", startAt: dayAfter, endAt: new Date(dayAfter.getTime() + 60 * 60000), location: "多摩センター店", color: "#8b5cf6" } });

  console.log("✅ Seed completed!");
  console.log(`  組織: ${org.name}`);
  console.log(`  ユーザー: ${user.name}`);
  console.log(`  ステータス: ${statusData.length}件`);
  console.log(`  テンプレート: 2件`);
  console.log(`  ワークフロー: 1件（2ステップ）`);
  console.log(`  サンプル顧客: 2件`);
  console.log(`  スケジュール: 2件`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
