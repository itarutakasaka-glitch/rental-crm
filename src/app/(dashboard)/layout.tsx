import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { LogoutButton } from "@/components/layout/logout-button";

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="1" y="1" width="30" height="30" rx="2" fill="none" stroke="#0891b2" strokeWidth="1.5" />
        <rect x="4" y="4" width="24" height="24" rx="1" fill="rgba(8,145,178,0.06)" stroke="#0891b2" strokeWidth="0.5" strokeDasharray="2 1" />
        <text x="16" y="21.5" textAnchor="middle" fontSize="16" fontWeight="900" fill="#0891b2" fontFamily="Rajdhani,sans-serif">C</text>
        <line x1="6" y1="26" x2="26" y2="26" stroke="#0891b2" strokeWidth="0.5" opacity="0.4" />
        <circle cx="6" cy="6" r="1.5" fill="#0891b2" opacity="0.6" />
        <circle cx="26" cy="6" r="1.5" fill="#0891b2" opacity="0.6" />
      </svg>
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
        background: "linear-gradient(90deg, #18181B 0%, #27272A 50%, #1C1917 100%)",
        padding: "0 20px", color: "#fff", flexShrink: 0,
        borderBottom: "1px solid rgba(245,158,11,0.15)",
        boxShadow: "0 1px 12px rgba(245,158,11,0.06)",
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
                padding: "6px 16px", fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.6)",
                textDecoration: "none", borderRadius: 4, letterSpacing: 1,
                fontFamily: "'Courier New', monospace",
              }}>{item.label}</a>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, opacity: 0.5, fontFamily: "monospace" }}>{user.email}</span>
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