import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";

export default async function CustomersPage() {
  const user = await getCurrentUser();
  const [customers, statuses] = await Promise.all([
    prisma.customer.findMany({ where: { organizationId: user.organizationId }, include: { status: true, assignee: true, properties: { take: 1 } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.status.findMany({ where: { organizationId: user.organizationId }, orderBy: { order: "asc" } }),
  ]);
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">顧客一覧 <span className="text-sm text-gray-400 font-normal">{customers.length}件</span></h1>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 bg-gray-50/50">
            {["顧客名","ステータス","反響元","物件","最終"].map(h=><th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">{h}</th>)}
          </tr></thead>
          <tbody>{customers.map((c: any) => (
            <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
              <td className="py-2.5 px-4"><Link href={`/customers/${c.id}`} className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{c.name[0]}</span>
                <div><div className="font-semibold flex items-center gap-1">{c.name}{c.isNeedAction&&<span className="w-1.5 h-1.5 rounded-full bg-red-500"/>}</div><div className="text-xs text-gray-400">{c.email}</div></div>
              </Link></td>
              <td className="py-2.5 px-4"><span className="text-xs font-semibold px-2 py-0.5 rounded" style={{backgroundColor:c.status.color+"15",color:c.status.color}}>{c.status.name}</span></td>
              <td className="py-2.5 px-4 text-xs text-gray-500">{c.sourcePortal}</td>
              <td className="py-2.5 px-4 text-xs text-gray-500 max-w-[150px] truncate">{c.properties[0]?.name}</td>
              <td className="py-2.5 px-4 text-xs text-gray-400">{c.lastActiveAt?.toLocaleDateString("ja-JP")}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
