import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { LogoutButton } from "@/components/layout/logout-button";

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{
          fontSize: 20, fontWeight: 700, letterSpacing: 2,
          fontFamily: "Rajdhani, 'Courier New', sans-serif",
          color: "#0891b2",
          textShadow: "0 0 8px rgba(8,145,178,0.3)",
        }}>Claude</span>
        <span style={{
          fontSize: 20, fontWeight: 500, letterSpacing: 2,
          fontFamily: "Rajdhani, 'Courier New', sans-serif",
          color: "#0891b2",
          textShadow: "0 0 8px rgba(8,145,178,0.3)",
        }}>Cloud</span>
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
          <Logo />
          <nav style={{ display: "flex", gap: 2 }}>
            {[
              { label: "ホーム", href: "/home" },
              { label: "顧客", href: "/customers" },
              { label: "スケジュール", href: "/schedule" },
            ].map((item) => (
              <a key={item.href} href={item.href} style={{
                padding: "6px 16px", fontSize: 12, fontWeight: 500, color: "#6b7280",
                textDecoration: "none", borderRadius: 4, letterSpacing: 1,
                fontFamily: "Rajdhani, 'Courier New', sans-serif",
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