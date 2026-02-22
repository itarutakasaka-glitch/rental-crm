"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError("\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u307E\u305F\u306F\u30D1\u30B9\u30EF\u30FC\u30C9\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093"); return; }
      router.push("/home"); router.refresh();
    } catch { setError("\u30ED\u30B0\u30A4\u30F3\u306B\u5931\u6557\u3057\u307E\u3057\u305F"); }
    finally { setLoading(false); }
  };
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f7f7f8", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: "linear-gradient(rgba(8,145,178,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(8,145,178,0.3) 1px, transparent 1px)",
        backgroundSize: "50px 50px",
      }} />
      <div style={{
        position: "relative", width: 380,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "40px 32px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}>
        <div style={{ position: "absolute", top: -1, left: -1, width: 20, height: 20, borderTop: "2px solid #0891b2", borderLeft: "2px solid #0891b2", borderRadius: "8px 0 0 0" }} />
        <div style={{ position: "absolute", top: -1, right: -1, width: 20, height: 20, borderTop: "2px solid #0891b2", borderRight: "2px solid #0891b2", borderRadius: "0 8px 0 0" }} />
        <div style={{ position: "absolute", bottom: -1, left: -1, width: 20, height: 20, borderBottom: "2px solid #0891b2", borderLeft: "2px solid #0891b2", borderRadius: "0 0 0 8px" }} />
        <div style={{ position: "absolute", bottom: -1, right: -1, width: 20, height: 20, borderBottom: "2px solid #0891b2", borderRight: "2px solid #0891b2", borderRadius: "0 0 8px 0" }} />
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none" style={{ marginBottom: 16 }}>
            <rect x="1" y="1" width="30" height="30" rx="2" fill="none" stroke="#0891b2" strokeWidth="1.5" />
            <rect x="4" y="4" width="24" height="24" rx="1" fill="rgba(8,145,178,0.04)" stroke="#0891b2" strokeWidth="0.5" strokeDasharray="2 1" />
            <text x="16" y="21.5" textAnchor="middle" fontSize="16" fontWeight="900" fill="#0891b2" fontFamily="Rajdhani,sans-serif">C</text>
            <circle cx="6" cy="6" r="1.5" fill="#0891b2" opacity="0.6" />
            <circle cx="26" cy="6" r="1.5" fill="#0891b2" opacity="0.6" />
          </svg>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, alignItems: "baseline" }}>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2, fontFamily: "Rajdhani, sans-serif", color: "#0891b2" }}>Claude</span>
            <span style={{ fontSize: 26, fontWeight: 500, letterSpacing: 2, fontFamily: "Rajdhani, sans-serif", color: "#0891b2" }}>Cloud</span>
          </div>
          <div style={{ fontSize: 10, letterSpacing: 6, color: "#9ca3af", marginTop: 6, fontFamily: "Rajdhani, sans-serif" }}>REAL ESTATE CRM</div>
          <div style={{ width: "100%", height: 1, background: "linear-gradient(90deg, transparent, rgba(8,145,178,0.2), transparent)", margin: "16px 0 0" }} />
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>EMAIL</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required
              style={{
                width: "100%", padding: "10px 12px", fontSize: 13, boxSizing: "border-box",
                background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6,
                outline: "none", color: "#374151",
              }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6 }}>PASSWORD</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" required
              style={{
                width: "100%", padding: "10px 12px", fontSize: 13, boxSizing: "border-box",
                background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6,
                outline: "none", color: "#374151",
              }} />
          </div>
          {error && <div style={{ fontSize: 12, color: "#dc2626", background: "#fef2f2", padding: "8px 12px", border: "1px solid #fecaca", borderRadius: 6, marginBottom: 16 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "11px", fontSize: 14, fontWeight: 700,
            background: loading ? "#e5e7eb" : "#0891b2",
            color: loading ? "#9ca3af" : "#fff", border: "none", borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "Rajdhani, sans-serif", letterSpacing: 2,
          }}>{loading ? "CONNECTING..." : "ACCESS"}</button>
        </form>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: "#d1d5db", fontFamily: "Rajdhani, sans-serif", letterSpacing: 2 }}>SYS.2026 // SECURE</div>
      </div>
    </div>
  );
}