"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/actions/auth";
import type { AuthUser } from "@/lib/auth";

const NAV = [
  { href: "/customers", icon: "則", label: "鬘ｧ螳｢荳隕ｧ" },
  { href: "/schedule", icon: "套", label: "繧ｹ繧ｱ繧ｸ繝･繝ｼ繝ｫ" },
  { href: "/analytics", icon: "投", label: "蛻・梵" },
  { href: "/settings", icon: "笞呻ｸ・, label: "險ｭ螳・ },
];

export function SidebarNav({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  return (
    <aside className="w-[200px] bg-gray-900 text-white flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-white/5">
        <div className="text-sm font-extrabold text-primary tracking-tight">荳榊虚逕｣CRM</div>
        <div className="text-[10px] text-gray-500 mt-0.5">{user.organizationName}</div>
      </div>
      <nav className="flex-1 p-2">
        {NAV.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm mb-0.5 transition ${active ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}>
              <span className="text-sm">{item.icon}</span>{item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-bold">{user.name[0]}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs truncate">{user.name}</div>
            <div className="text-[10px] text-gray-500">{user.role === "ADMIN" ? "邂｡逅・・ : "繝｡繝ｳ繝舌・"}</div>
          </div>
          <button onClick={() => startTransition(() => signOut())} className="text-xs text-gray-600 hover:text-white" title="繝ｭ繧ｰ繧｢繧ｦ繝・>坎</button>
        </div>
      </div>
    </aside>
  );
}

