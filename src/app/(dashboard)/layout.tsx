import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/layout/sidebar-nav";

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="4" fill="rgba(255,255,255,0.2)" />
        <path d="M14 4L6 8v4c0 5.55 3.42 10.74 8 12 4.58-1.26 8-6.45 8-12V8l-8-4z" fill="rgba(255,255,255,0.9)" />
        <path d="M14 6.5L8 9.5v3c0 4.16 2.56 8.06 6 9 3.44-.94 6-4.84 6-9v-3l-6-3z" fill="none" stroke="rgba(255,200,100,0.8)" strokeWidth="0.5" />
        <text x="14" y="18" textAnchor="middle" fontSize="9" fontWeight="900" fill="#D97706" fontFamily="Georgia,serif">C</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span style={{
          fontSize: 15, fontWeight: 800, letterSpacing: 3, fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#fff", textTransform: "uppercase" as const, textShadow: "0 1px 2px rgba(0,0,0,0.15)",
        }}>CLAVDE</span>
        <span style={{
          fontSize: 8, fontWeight: 600, letterSpacing: 5, color: "rgba(255,255,255,0.7)",
          textTransform: "uppercase" as const, marginTop: 1,
        }}>CLOVD · CRM</span>
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
                transition: "background 0.2s",
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