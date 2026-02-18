import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const [sCount, tCount, wCount] = await Promise.all([
    prisma.status.count({ where: { organizationId: user.organizationId } }),
    prisma.template.count({ where: { organizationId: user.organizationId } }),
    prisma.workflow.count({ where: { organizationId: user.organizationId } }),
  ]);
  const items = [
    { href: "/settings/status", icon: "🏷️", label: "ステータス設定", desc: "営業進捗ステータスを管理", count: sCount },
    { href: "/settings/templates", icon: "📝", label: "テンプレート設定", desc: "メール・LINE・SMSの定型文を管理", count: tCount },
    { href: "/settings/workflow", icon: "🔄", label: "ワークフロー設定", desc: "自動追客フローの設定・管理", count: wCount },
  ];
  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-bold mb-4">設定</h1>
      {items.map(i => (
        <Link key={i.href} href={i.href} className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 mb-2 hover:border-primary/30 hover:shadow-sm transition">
          <span className="text-2xl">{i.icon}</span>
          <div className="flex-1"><div className="font-semibold">{i.label}</div><div className="text-xs text-gray-400 mt-0.5">{i.desc}</div></div>
          <span className="text-sm text-gray-400">{i.count}件 →</span>
        </Link>
      ))}
    </div>
  );
}
