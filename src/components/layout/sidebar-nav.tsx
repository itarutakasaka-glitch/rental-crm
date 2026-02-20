"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const navItems = [
  { label: "顧客一覧", href: "/customers", icon: "👤", children: [
    { label: "リスト表示", href: "/customers" },
    { label: "ボード表示", href: "/customers?view=board" },
  ]},
  { label: "一斉送信", href: "/broadcast", icon: "✉️" },
  { label: "設定", href: "/settings", icon: "⚙️", children: [
    { label: "ステータス", href: "/settings" },
    { label: "定型文", href: "/settings/templates" },
    { label: "ワークフロー", href: "/settings/workflows" },
    { label: "組織情報", href: "/settings/organization" },
    { label: "担当者", href: "/settings/staff" },
  ]},
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 180, minWidth: 180, background: "#fff", borderRight: "1px solid #e5e7eb",
      display: "flex", flexDirection: "column", overflow: "auto", flexShrink: 0,
      fontSize: 13,
    }}>
      <nav style={{ padding: "12px 0" }}>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <div key={item.href}>
              <Link href={item.href} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 16px", color: isActive ? "#29B6F6" : "#374151",
                textDecoration: "none", fontWeight: isActive ? 600 : 400,
                borderLeft: isActive ? "3px solid #29B6F6" : "3px solid transparent",
                background: isActive ? "#F0F9FF" : "transparent",
                transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                {item.label}
              </Link>
              {item.children && isActive && (
                <div style={{ paddingLeft: 38 }}>
                  {item.children.map((child) => {
                    const childActive = pathname === child.href;
                    return (
                      <Link key={child.href} href={child.href} style={{
                        display: "block", padding: "5px 0", fontSize: 12,
                        color: childActive ? "#29B6F6" : "#6b7280",
                        textDecoration: "none", fontWeight: childActive ? 600 : 400,
                      }}>
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}