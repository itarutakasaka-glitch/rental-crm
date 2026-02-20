"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

const menuItems = [
  {
    label: "顧客一覧", icon: "👤", href: "/customers",
    children: [{ label: "リスト表示", href: "/customers" }],
  },
  { label: "一斉送信", icon: "📨", href: "/broadcast" },
  {
    label: "設定", icon: "⚙️", href: "/settings",
    children: [
      { label: "ステータス", href: "/settings/status" },
      { label: "定型文", href: "/settings/templates" },
      { label: "ワークフロー", href: "/settings/workflow" },
      { label: "組織情報", href: "/settings/organization" },
      { label: "担当者", href: "/settings/staff" },
    ],
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string[]>(["/customers", "/settings"]);

  const toggle = (href: string) => {
    setExpanded((prev) => prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]);
  };

  return (
    <aside style={{
      width: 160, minWidth: 160, background: "#fff", borderRight: "1px solid #e5e7eb",
      overflow: "auto", padding: "12px 0", flexShrink: 0,
    }}>
      {menuItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const isOpen = expanded.includes(item.href);
        return (
          <div key={item.href}>
            <div onClick={() => item.children ? toggle(item.href) : null} style={{ cursor: "pointer" }}>
              <Link href={item.href} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? "#D97706" : "#374151",
                textDecoration: "none",
                background: isActive ? "#FEF3C7" : "transparent",
                borderLeft: isActive ? "3px solid #D97706" : "3px solid transparent",
              }}>
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                {item.label}
              </Link>
            </div>
            {item.children && isOpen && (
              <div style={{ paddingLeft: 20 }}>
                {item.children.map((child) => {
                  const childActive = pathname === child.href;
                  return (
                    <Link key={child.href} href={child.href} style={{
                      display: "block", padding: "5px 16px", fontSize: 12,
                      color: childActive ? "#D97706" : "#6b7280",
                      fontWeight: childActive ? 600 : 400,
                      textDecoration: "none",
                    }}>{child.label}</Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}