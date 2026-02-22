import { redirect } from "next/navigation";
import { Rajdhani } from "next/font/google";

const rajdhani = Rajdhani({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { LogoutButton } from "@/components/layout/logout-button";

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div className={rajdhani.className} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 500, letterSpacing: 2, color: "#0891b2", lineHeight: 1 }}>Claude</span>
        <span style={{ fontSize: 26, fontWeight: 500, letterSpacing: 2, color: "#0891b2", lineHeight: 1 }}>Cloud</span>
      </div>
    </div>
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <header style={{
        height: 48, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#ffffff", borderBottom: "1px solid #e5e7eb",
        padding: "0 20px", color: "#374151", flexShrink: 0,

      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <a href="/home" style={{ textDecoration: "none" }}><Logo /></a>
          <nav style={{ display: "flex", gap: 2 }}>
            {[
              { label: "ホーム", href: "/home" },
              { label: "顧客", href: "/customers" },
              { label: "スケジュール", href: "/schedule" },
            ].map((item) => (
              <a key={item.href} href={item.href} style={{
                padding: "6px 16px", fontSize: 12, fontWeight: 500, color: "#6b7280",
                textDecoration: "none", borderRadius: 4, letterSpacing: 1,
                
              }}>{item.label}</a>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>{user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <SidebarNav />
        <main style={{ flex: 1, overflow: "hidden", background: "#F8F9FB", display: "flex", flexDirection: "column" }}>
          {children}
        </main>
      </div>
    </div>
  );
}