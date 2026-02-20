import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Top Navigation Bar - CANARY Cloud style */}
      <header style={{
        height: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(90deg, #4FC3F7 0%, #29B6F6 100%)", padding: "0 20px", color: "#fff", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 1 }}>たま不動産 CRM</span>
          <nav style={{ display: "flex", gap: 4 }}>
            {[
              { label: "ホーム", href: "/home" },
              { label: "顧客", href: "/customers" },
              { label: "スケジュール", href: "/schedule" },
            ].map((item) => (
              <a key={item.href} href={item.href} style={{
                padding: "6px 14px", fontSize: 13, fontWeight: 500, color: "#fff",
                textDecoration: "none", borderRadius: 4, transition: "background 0.15s",
              }}>{item.label}</a>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, opacity: 0.9 }}>{user.email}</span>
        </div>
      </header>
      {/* Body: Sidebar + Content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <SidebarNav />
        <main style={{ flex: 1, overflow: "hidden", background: "#F8F9FB", display: "flex", flexDirection: "column" }}>
          {children}
        </main>
      </div>
    </div>
  );
}