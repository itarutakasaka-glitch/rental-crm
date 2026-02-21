"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

const menuItems = [
  { label: "\u9867\u5BA2\u4E00\u89A7", icon: "\u{1F464}", href: "/customers" },
  { label: "\u4E00\u6589\u9001\u4FE1", icon: "\u{1F4E8}", href: "/broadcast" },
  {
    label: "\u8A2D\u5B9A", icon: "\u2699", href: "/settings",
    children: [
      { label: "\u30B9\u30C6\u30FC\u30BF\u30B9", href: "/settings/status" },
      { label: "\u5B9A\u578B\u6587", href: "/settings/templates" },
      { label: "\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC", href: "/settings/workflow" },
      { label: "\u7D44\u7E54\u60C5\u5831", href: "/settings/organization" },
      { label: "\u62C5\u5F53\u8005", href: "/settings/staff" },
    ],
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string[]>(["/settings"]);
  const toggle = (href: string) => {
    setExpanded((prev) => prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]);
  };
  return (
    <aside style={{
      width: 160, minWidth: 160, background: "#fff", borderRight: "1px solid #e5e7eb",
      overflow: "auto", padding: "12px 0", flexShrink: 0,
    }}>
      {menuItems.map((item) => {
        const hasChildren = "children" in item && !!item.children;
        const isActive = pathname.startsWith(item.href);
        const isOpen = expanded.includes(item.href);
        return (
          <div key={item.href}>
            <div onClick={() => hasChildren ? toggle(item.href) : null} style={{ cursor: "pointer" }}>
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
            {hasChildren && isOpen && (
              <div style={{ paddingLeft: 20 }}>
                {item.children!.map((child) => {
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
