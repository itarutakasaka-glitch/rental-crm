"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/actions/auth";
import type { AuthUser } from "@/lib/auth";

const NAV = [
  { href: "/inbox", icon: "\uD83D\uDCE5", label: "\u53D7\u4FE1\u30C8\u30EC\u30A4" },
  { href: "/customers", icon: "\uD83D\uDC65", label: "\u9867\u5BA2\u4E00\u89A7" },
  { href: "/schedule", icon: "\uD83D\uDCC5", label: "\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB" },
  { href: "/analytics", icon: "\uD83D\uDCCA", label: "\u5206\u6790" },
  { href: "/settings", icon: "\u2699\uFE0F", label: "\u8A2D\u5B9A" },
];

export function SidebarNav({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  return (
    <aside className="w-[200px] bg-slate-900 text-white flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-slate-700/50">
        <div className="text-sm font-extrabold text-indigo-400 tracking-tight">{"\u4E0D\u52D5\u7523CRM"}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">{user.organizationName}</div>
      </div>
      <nav className="flex-1 p-2">
        {NAV.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm mb-0.5 transition ${active ? "bg-indigo-500/15 text-indigo-300" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"}`}>
              <span className="text-sm">{item.icon}</span>{item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs text-indigo-400 font-bold">{user.name[0]}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs truncate">{user.name}</div>
            <div className="text-[10px] text-gray-500">{user.role === "ADMIN" ? "\u7BA1\u7406\u8005" : "\u30E1\u30F3\u30D0\u30FC"}</div>
          </div>
          <button onClick={() => startTransition(() => signOut())} className="text-xs text-slate-500 hover:text-slate-200" title={"\u30ED\u30B0\u30A2\u30A6\u30C8"}>{"\uD83D\uDEAA"}</button>
        </div>
      </div>
    </aside>
  );
}
