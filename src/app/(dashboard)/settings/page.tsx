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
    { href: "/settings/organization", icon: "\uD83C\uDFE2", label: "\u4F1A\u793E\u30FB\u5E97\u8217\u60C5\u5831", desc: "\u4F1A\u793E\u540D\u30FB\u4F4F\u6240\u30FB\u96FB\u8A71\u30FB\u514D\u8A31\u756A\u53F7\u306A\u3069\u3092\u7BA1\u7406", count: null },
    { href: "/settings/status", icon: "\uD83C\uDFF7\uFE0F", label: "\u30B9\u30C6\u30FC\u30BF\u30B9\u8A2D\u5B9A", desc: "\u55B6\u696D\u9032\u6357\u30B9\u30C6\u30FC\u30BF\u30B9\u3092\u7BA1\u7406", count: sCount },
    { href: "/settings/templates", icon: "\uD83D\uDCDD", label: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u8A2D\u5B9A", desc: "\u30E1\u30FC\u30EB\u30FBLINE\u30FBSMS\u306E\u5B9A\u578B\u6587\u3092\u7BA1\u7406", count: tCount },
    { href: "/settings/workflow", icon: "\uD83D\uDD04", label: "\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u8A2D\u5B9A", desc: "\u81EA\u52D5\u8FFD\u5BA2\u30D5\u30ED\u30FC\u306E\u8A2D\u5B9A\u30FB\u7BA1\u7406", count: wCount },
  ];
  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-bold mb-4">{"\u8A2D\u5B9A"}</h1>
      {items.map(i => (
        <Link key={i.href} href={i.href} className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 mb-2 hover:border-primary/30 hover:shadow-sm transition">
          <span className="text-2xl">{i.icon}</span>
          <div className="flex-1"><div className="font-semibold">{i.label}</div><div className="text-xs text-gray-400 mt-0.5">{i.desc}</div></div>
          {i.count !== null && <span className="text-sm text-gray-400">{i.count}{"\u4EF6"} {"\u2192"}</span>}
          {i.count === null && <span className="text-sm text-gray-400">{"\u2192"}</span>}
        </Link>
      ))}
    </div>
  );
}
