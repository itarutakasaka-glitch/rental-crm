import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/layout/sidebar-nav";

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
        </defs>
        <path d="M16 2L4 8v8c0 8.88 5.12 17.16 12 19.2 6.88-2.04 12-10.32 12-19.2V8L16 2z" fill="url(#sg)" />
        <path d="M16 5L7 10v6c0 7.4 4.27 14.3 9 16 4.73-1.7 9-8.6 9-16v-6L16 5z" fill="rgba(255,255,255,0.15)" />
        <text x="16" y="22" textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff" fontFamily="Georgia,serif" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>C</text>
      </svg>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{
          fontSize: 17, fontWeight: 800, letterSpacing: 1.5, fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}>Claude Cloud</span>
        <span style={{
          fontSize: 9, fontWeight: 600, letterSpacing: 2, color: "rgba(255,255,255,0.5)",
          textTransform: "uppercase" as const,
        }}>CRM</span>
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
        background: "linear-gradient(90deg, #92400E 0%, #B45309 30%, #D97706 100%)",
        padding: "0 20px", color: "#fff", flexShrink: 0,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
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
                padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)",
                textDecoration: "none", borderRadius: 4, letterSpacing: 0.5,
              }}>{item.label}</a>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, opacity: 0.8 }}>{user.email}</span>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.2)",
            border: "1.5px solid rgba(255,255,255,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#fff",
          }}>{user.email?.charAt(0).toUpperCase()}</div>
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