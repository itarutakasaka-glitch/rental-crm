import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // 驍ｨ繝ｻ・ｹ繝ｻ
  const org = await prisma.organization.create({ data: { name: "郢ｧ・｢郢昜ｻ｣繝ｻ郢晢ｽｳ郢ｧ・ｷ郢晢ｽｧ郢昴・繝ｻ陞溷｣ｽ譚溽ｹｧ・ｻ郢晢ｽｳ郢ｧ・ｿ郢晢ｽｼ陟弱・, phone: "042-123-4567", email: "info@apaman-tama.jp", address: "隴夲ｽｱ闔・ｬ鬩幢ｽｽ陞溷｣ｽ譚溯涕繧願ｪ陷ｷ繝ｻ-1-1" } });

  // 郢晢ｽｦ郢晢ｽｼ郢ｧ・ｶ郢晢ｽｼ
  const user = await prisma.user.create({ data: { organizationId: org.id, email: "yoshida@apaman-tama.jp", name: "陷ｷ閾･莨・, role: "ADMIN" } });

  // 郢ｧ・ｹ郢昴・繝ｻ郢ｧ・ｿ郢ｧ・ｹ
  const statusData = [
    { name: "隴・ｽｰ髫穂ｸ橸ｽｯ・ｾ陟｢繝ｻ, color: "#ef4444", order: 1, isDefault: true },
    { name: "陋ｻ譎・ｄ陝・ｽｾ陟｢諛茨ｽｸ繝ｻ, color: "#f97316", order: 2 },
    { name: "髴第ｯ費ｽｿ・｡霎滂ｽ｡邵ｺ繝ｻ, color: "#eab308", order: 3 },
    { name: "髴托ｽｽ陞ｳ・｢闕ｳ・ｭ", color: "#3b82f6", order: 4 },
    { name: "隴夲ｽ･陟主ｶｺ・ｺ閧ｲ・ｴ繝ｻ, color: "#8b5cf6", order: 5 },
    { name: "隴夲ｽ･陟守軸・ｸ繝ｻ, color: "#6366f1", order: 6 },
    { name: "騾包ｽｳ髴趣ｽｼ陷代・, color: "#10b981", order: 7 },
    { name: "陞ｳ蠕｡・ｺ繝ｻ, color: "#6b7280", order: 8 },
    { name: "鬮滂ｽｷ隴帶ｺｯ・ｿ・ｽ陞ｳ・｢", color: "#06b6d4", order: 9 },
    { name: "闔ｨ隨ｬ・ｭ・｢", color: "#94a3b8", order: 10 },
    { name: "陞滂ｽｱ雎包ｽｨ", color: "#cbd5e1", order: 11 },
  ];
  const statuses: Record<string, any> = {};
  for (const s of statusData) {
    statuses[s.name] = await prisma.status.create({ data: { organizationId: org.id, ...s } });
  }

  // 郢昴・ﾎｦ郢晏干ﾎ樒ｹ晢ｽｼ郢晏現縺咲ｹ昴・縺也ｹ晢ｽｪ
  const cat1 = await prisma.templateCategory.create({ data: { organizationId: org.id, name: "陋ｻ譎・ｄ陝・ｽｾ陟｢繝ｻ, order: 1 } });
  const cat2 = await prisma.templateCategory.create({ data: { organizationId: org.id, name: "髴托ｽｽ陞ｳ・｢", order: 2 } });

  // 郢昴・ﾎｦ郢晏干ﾎ樒ｹ晢ｽｼ郢昴・
  const tpl1 = await prisma.template.create({
    data: { organizationId: org.id, categoryId: cat1.id, name: "陋ｻ譎丞ｱ馴恆豈費ｽｿ・｡郢晢ｽ｡郢晢ｽｼ郢晢ｽｫ", channel: "EMAIL",
      subject: "邵ｲ闊後＞郢昜ｻ｣繝ｻ郢晢ｽｳ郢ｧ・ｷ郢晢ｽｧ郢昴・繝ｻ陞溷｣ｽ譚溽ｹｧ・ｻ郢晢ｽｳ郢ｧ・ｿ郢晢ｽｼ陟主干ﾂ莉｣笙陜荳奇ｼ櫁惺蛹ｻ・冗ｸｺ蟶吮旺郢ｧ鄙ｫ窶ｲ邵ｺ・ｨ邵ｺ繝ｻ・・ｸｺ謔ｶ・樒ｸｺ・ｾ邵ｺ繝ｻ,
      body: "{鬯假ｽｧ陞ｳ・｢陷ｷ髢､隶堤ｦ・\n邵ｺ阮吶・陟趣ｽｦ邵ｺ・ｯ邵ｺ髮∵牒邵ｺ繝ｻ邊狗ｹｧ荳岩雷邵ｺ繝ｻ笳・ｸｺ・ｰ邵ｺ髦ｪﾂ竏ｬ・ｪ・ｰ邵ｺ・ｫ邵ｺ繧・ｽ顔ｸｺ蠕娯・邵ｺ繝ｻ・・ｸｺ謔ｶ・樒ｸｺ・ｾ邵ｺ蜷ｶﾂ繝ｻn郢ｧ・｢郢昜ｻ｣繝ｻ郢晢ｽｳ郢ｧ・ｷ郢晢ｽｧ郢昴・繝ｻ陞溷｣ｽ譚溽ｹｧ・ｻ郢晢ｽｳ郢ｧ・ｿ郢晢ｽｼ陟主干繝ｻ{隲｡繝ｻ・ｽ讌｢ﾂ繝ｻ骭図邵ｺ譴ｧ逅・冶侭・・ｸｺ蟶吮ｻ邵ｺ繝ｻ笳・ｸｺ・ｰ邵ｺ髦ｪ竏ｪ邵ｺ蜷ｶﾂ繝ｻn\n邵ｺ髮∵牒邵ｺ繝ｻ邊狗ｹｧ荳岩雷邵ｺ繝ｻ笳・ｸｺ・ｰ邵ｺ繝ｻ笳・ｿ夲ｽｩ闔会ｽｶ邵ｺ・ｫ邵ｺ・､邵ｺ繝ｻ窶ｻ邵ｲ竏ｵ諤呵ｭ・ｽｰ邵ｺ・ｮ驕ｨ・ｺ陞ｳ・､霑･・ｶ雎補・・帝￡・ｺ髫ｱ髦ｪ繝ｻ邵ｺ繝ｻ竏ｴ邵ｲ竏ｵ髫ｼ郢ｧ竏壺ｻ邵ｺ遘伉・｣驍ｨ・｡邵ｺ霈披雷邵ｺ・ｦ邵ｺ繝ｻ笳・ｸｺ・ｰ邵ｺ髦ｪ竏ｪ邵ｺ蜷ｶﾂ繝ｻn\n隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉\n郢ｧ・｢郢昜ｻ｣繝ｻ郢晢ｽｳ郢ｧ・ｷ郢晢ｽｧ郢昴・繝ｻ陞溷｣ｽ譚溽ｹｧ・ｻ郢晢ｽｳ郢ｧ・ｿ郢晢ｽｼ陟惹ｺ・陷ｷ閾･莨・TEL: 042-123-4567\n隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉隨渉" },
  });
  const tpl2 = await prisma.template.create({
    data: { organizationId: org.id, categoryId: cat2.id, name: "髴托ｽｽ陞ｳ・｢郢晢ｽ｡郢晢ｽｼ郢晢ｽｫ1鬨ｾ螟ょｲｼ", channel: "EMAIL",
      subject: "邵ｲ闊後＞郢昜ｻ｣繝ｻ郢晢ｽｳ郢ｧ・ｷ郢晢ｽｧ郢昴・繝ｻ陞溷｣ｽ譚溽ｹｧ・ｻ郢晢ｽｳ郢ｧ・ｿ郢晢ｽｼ陟主干ﾂ驢埼ｻ・脂・ｶ邵ｺ・ｮ驕ｨ・ｺ陞ｳ・､霑･・ｶ雎補・繝ｻ邵ｺ遘伉・｣驍ｨ・｡",
      body: "{鬯假ｽｧ陞ｳ・｢陷ｷ髢､隶堤ｦ・\n邵ｺ雍具ｽｸ蜀ｶ・ｩ・ｱ邵ｺ・ｫ邵ｺ・ｪ邵ｺ・｣邵ｺ・ｦ邵ｺ鄙ｫ・顔ｸｺ・ｾ邵ｺ蜷ｶﾂ繧・ｿ騾包ｽｰ邵ｺ・ｧ邵ｺ蜷ｶﾂ繝ｻn陷亥沺蠕狗ｸｺ髮∵牒邵ｺ繝ｻ邊狗ｹｧ荳岩雷邵ｺ繝ｻ笳・ｸｺ・ｰ邵ｺ繝ｻ笳・ｿ夲ｽｩ闔会ｽｶ邵ｺ・ｫ邵ｺ・､邵ｺ繝ｻ窶ｻ驕抵ｽｺ髫ｱ髦ｪ窶ｲ陷ｿ謔ｶ・檎ｸｺ・ｾ邵ｺ蜉ｱ笳・ｸｺ・ｮ邵ｺ・ｧ邵ｺ遘伉・｣驍ｨ・｡邵ｺ繝ｻ笳・ｸｺ蜉ｱ竏ｪ邵ｺ蜷ｶﾂ繝ｻn邵ｺ逍ｲ謫り主干繝ｻ郢ｧ・ｪ郢晢ｽｳ郢晢ｽｩ郢ｧ・､郢晢ｽｳ騾ｶ・ｸ髫ｲ繝ｻ・りｬ・ｽｿ邵ｺ・｣邵ｺ・ｦ邵ｺ鄙ｫ・顔ｸｺ・ｾ邵ｺ蜷ｶﾂ繝ｻ },
  });

  // 郢晢ｽｯ郢晢ｽｼ郢ｧ・ｯ郢晁ｼ釆溽ｹ晢ｽｼ
  const wf = await prisma.workflow.create({ data: { organizationId: org.id, name: "郢昴・繝ｵ郢ｧ・ｩ郢晢ｽｫ郢晞メ・ｿ・ｽ陞ｳ・｢郢晁ｼ釆溽ｹ晢ｽｼ", isDefault: true, isActive: true } });
  await prisma.workflowStep.create({ data: { workflowId: wf.id, name: "陋ｻ譎丞ｱ馴恆豈費ｽｿ・｡郢晢ｽ｡郢晢ｽｼ郢晢ｽｫ", daysAfter: 0, timeOfDay: "陷奇ｽｳ隴弱・, channel: "EMAIL", templateId: tpl1.id, order: 1 } });
  await prisma.workflowStep.create({ data: { workflowId: wf.id, name: "髴托ｽｽ陞ｳ・｢郢晢ｽ｡郢晢ｽｼ郢晢ｽｫ遶ｭ・ｰ", daysAfter: 1, timeOfDay: "10:00", channel: "EMAIL", templateId: tpl2.id, order: 2 } });

  // 郢ｧ・ｵ郢晢ｽｳ郢晏干ﾎ晞ｬ假ｽｧ陞ｳ・｢
  const cust1 = await prisma.customer.create({
    data: { organizationId: org.id, name: "霓｢・ｬ隰鯉ｽｸ雎輔・, email: "giabbit.izumi@iCloud.com", phone: "090-4327-1424", preferredContact: "鬮ｮ・ｻ髫ｧ・ｱ", sourcePortal: "郢ｧ・｢郢昜ｻ｣繝ｻ郢晢ｽｳ郢ｧ・ｷ郢晢ｽｧ郢昴・繝ｻ",
      statusId: statuses["隴・ｽｰ髫穂ｸ橸ｽｯ・ｾ陟｢繝ｻ].id, assigneeId: user.id, isNeedAction: true, lastActiveAt: new Date() },
  });
  await prisma.inquiryProperty.create({ data: { customerId: cust1.id, name: "郢晁侭ﾎ樒ｹ昴・縺夂ｹ昜ｸ翫∴郢ｧ・ｹ陝・ｹ暦ｽｯ豈費ｽｼ繝ｻ陷ｿ・ｷ隴ｽ繝ｻ, address: "隴夲ｽｱ闔・ｬ鬩幢ｽｽ陷茨ｽｫ驍・唱・ｭ莉呻ｽｸ繧・ｽｰ荵暦ｽｯ豈費ｽｼ竏ｫ莨ｴ", station: "陞溷｣ｽ譚溽ｹ晢ｽ｢郢晏ｼｱﾎ樒ｹ晢ｽｼ郢晢ｽｫ/陞ｻ・ｱ騾包ｽｰ鬯ｧ繝ｻ, roomNumber: "205陷ｿ・ｷ陞ｳ・､", rent: "61100", area: "49.2", layout: "2DK" } });
  await prisma.customerTag.create({ data: { customerId: cust1.id, name: "郢ｧ・｢郢昜ｻ｣繝ｻ郢晢ｽｳ陷ｿ蝓ｼ豸ｸ" } });
  await prisma.message.create({ data: { customerId: cust1.id, direction: "INBOUND", channel: "EMAIL", subject: "驕ｨ・ｺ陞ｳ・､驕抵ｽｺ髫ｱ繝ｻ, body: "隴崢隴・ｽｰ邵ｺ・ｮ驕ｨ・ｺ陞ｳ・､霑･・ｶ雎補・・帝￥・･郢ｧ鄙ｫ笳・ｸｺ繝ｻ, status: "SENT" } });

  const cust2 = await prisma.customer.create({
    data: { organizationId: org.id, name: "隘搾ｽ､隴上・, email: "tommygatta@yahoo.co.jp", phone: "080-1043-2464", preferredContact: "郢晢ｽ｡郢晢ｽｼ郢晢ｽｫ", sourcePortal: "SUUMO",
      statusId: statuses["陋ｻ譎・ｄ陝・ｽｾ陟｢諛茨ｽｸ繝ｻ].id, assigneeId: user.id, isNeedAction: false, lastActiveAt: new Date(Date.now() - 86400000) },
  });
  await prisma.inquiryProperty.create({ data: { customerId: cust2.id, name: "魄厄ｽｿ陝ｲ・ｶ陜暦ｽ｣陜ｨ・ｰ2陷ｿ・ｷ隴ｽ繝ｻ08", address: "隴夲ｽｱ闔・ｬ鬩幢ｽｽ陷茨ｽｫ驍・唱・ｭ莉呻ｽｸ繧具ｽｹ・ｿ陝ｲ・ｶ", station: "陞溷｣ｽ譚滄ｩ幢ｽｽ陝ｶ繧・皮ｹ晏ｼｱﾎ樒ｹ晢ｽｼ郢晢ｽｫ/隴夲ｽｾ邵ｺ迹夲ｽｰ・ｷ", rent: "92000", area: "52.58", layout: "2LDK", portalUrl: "https://suumo.jp/chintai/bc_100489123435/" } });
  await prisma.customerTag.create({ data: { customerId: cust2.id, name: "SUUMO陷ｿ蝓ｼ豸ｸ" } });
  await prisma.message.create({ data: { customerId: cust2.id, direction: "INBOUND", channel: "EMAIL", subject: "邵ｺ髮∵牒邵ｺ繝ｻ邊狗ｹｧ荳岩雷", body: "邵ｺ阮吶・鬩幢ｽｨ陞ｻ荵昶・鬮｢・｢邵ｺ蜉ｱ窶ｻ髫ｧ・ｳ邵ｺ蜉ｱ・･隰ｨ蜷ｶ竏ｴ邵ｺ・ｦ隹ｺ・ｲ邵ｺ蜉ｱ・・, status: "SENT" } });
  await prisma.message.create({ data: { customerId: cust2.id, senderId: user.id, direction: "OUTBOUND", channel: "EMAIL", subject: "邵ｲ闊後＞郢昜ｻ｣繝ｻ郢晢ｽｳ郢ｧ・ｷ郢晢ｽｧ郢昴・繝ｻ陞溷｣ｽ譚溽ｹｧ・ｻ郢晢ｽｳ郢ｧ・ｿ郢晢ｽｼ陟主干ﾂ莉｣笙陜荳奇ｼ櫁惺蛹ｻ・冗ｸｺ蟶吮旺郢ｧ鄙ｫ窶ｲ邵ｺ・ｨ邵ｺ繝ｻ・・ｸｺ謔ｶ・樒ｸｺ・ｾ邵ｺ繝ｻ, body: "隘搾ｽ､隴乗ｻ難ｽｧ遖・\n邵ｺ阮吶・陟趣ｽｦ邵ｺ・ｯ邵ｺ髮∵牒邵ｺ繝ｻ邊狗ｹｧ荳岩雷邵ｺ繝ｻ笳・ｸｺ・ｰ邵ｺ髦ｪﾂ竏ｬ・ｪ・ｰ邵ｺ・ｫ邵ｺ繧・ｽ顔ｸｺ蠕娯・邵ｺ繝ｻ・・ｸｺ謔ｶ・樒ｸｺ・ｾ邵ｺ蜷ｶﾂ繝ｻn郢ｧ・｢郢昜ｻ｣繝ｻ郢晢ｽｳ郢ｧ・ｷ郢晢ｽｧ郢昴・繝ｻ陞溷｣ｽ譚溽ｹｧ・ｻ郢晢ｽｳ郢ｧ・ｿ郢晢ｽｼ陟主干繝ｻ陷ｷ閾･莨千ｸｺ譴ｧ逅・冶侭・・ｸｺ蟶吮ｻ邵ｺ繝ｻ笳・ｸｺ・ｰ邵ｺ髦ｪ竏ｪ邵ｺ蜷ｶﾂ繝ｻn\n魄厄ｽｿ陝ｲ・ｶ陜暦ｽ｣陜ｨ・ｰ2陷ｿ・ｷ隴ｽ繝ｻ08邵ｺ・ｫ邵ｺ・､邵ｺ繝ｻ窶ｻ邵ｲ竏ｫ讓溯舉・ｨ驕ｨ・ｺ陞ｳ・､邵ｺ・ｧ邵ｺ逍ｲ・｡莠･繝ｻ陷ｿ・ｯ髢ｭ・ｽ邵ｺ・ｧ邵ｺ蜷ｶﾂ繝ｻn\n邵ｺ逍ｲ謫り主干繝ｻ郢ｧ・ｪ郢晢ｽｳ郢晢ｽｩ郢ｧ・､郢晢ｽｳ騾ｶ・ｸ髫ｲ繝ｻ・りｬ・ｽｿ邵ｺ・｣邵ｺ・ｦ邵ｺ鄙ｫ・顔ｸｺ・ｾ邵ｺ蜷ｶﾂ繝ｻ, status: "SENT", openedAt: new Date(Date.now() - 43200000), openCount: 2 } });

  // 郢ｧ・ｵ郢晢ｽｳ郢晏干ﾎ晉ｹｧ・ｹ郢ｧ・ｱ郢ｧ・ｸ郢晢ｽ･郢晢ｽｼ郢晢ｽｫ
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(14, 0, 0, 0);
  const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2); dayAfter.setHours(10, 0, 0, 0);
  await prisma.schedule.create({ data: { organizationId: org.id, userId: user.id, customerId: cust1.id, title: "霓｢・ｬ隰鯉ｽｸ隶偵・隴ｫ・ｶ鬮ｮ・ｻ郢晁ｼ斐°郢晢ｽｭ郢晢ｽｼ", type: "CALL", startAt: tomorrow, endAt: new Date(tomorrow.getTime() + 30 * 60000), color: "#f59e0b" } });
  await prisma.schedule.create({ data: { organizationId: org.id, userId: user.id, customerId: cust2.id, title: "隘搾ｽ､隴乗ｻ難ｽｧ繝ｻ隴夲ｽ･陟弱・, type: "VISIT", startAt: dayAfter, endAt: new Date(dayAfter.getTime() + 60 * 60000), location: "陞溷｣ｽ譚溽ｹｧ・ｻ郢晢ｽｳ郢ｧ・ｿ郢晢ｽｼ陟弱・, color: "#8b5cf6" } });

  console.log("隨ｨ繝ｻSeed completed!");
  console.log(`  驍ｨ繝ｻ・ｹ繝ｻ ${org.name}`);
  console.log(`  郢晢ｽｦ郢晢ｽｼ郢ｧ・ｶ郢晢ｽｼ: ${user.name}`);
  console.log(`  郢ｧ・ｹ郢昴・繝ｻ郢ｧ・ｿ郢ｧ・ｹ: ${statusData.length}闔会ｽｶ`);
  console.log(`  郢昴・ﾎｦ郢晏干ﾎ樒ｹ晢ｽｼ郢昴・ 2闔会ｽｶ`);
  console.log(`  郢晢ｽｯ郢晢ｽｼ郢ｧ・ｯ郢晁ｼ釆溽ｹ晢ｽｼ: 1闔会ｽｶ繝ｻ繝ｻ郢ｧ・ｹ郢昴・繝｣郢晄圜・ｼ闕・;
  console.log(`  郢ｧ・ｵ郢晢ｽｳ郢晏干ﾎ晞ｬ假ｽｧ陞ｳ・｢: 2闔会ｽｶ`);
  console.log(`  郢ｧ・ｹ郢ｧ・ｱ郢ｧ・ｸ郢晢ｽ･郢晢ｽｼ郢晢ｽｫ: 2闔会ｽｶ`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
