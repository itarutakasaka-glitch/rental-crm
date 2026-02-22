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
      if (error) { setError("メールアドレスまたはパスワードが正しくありません"); return; }
      router.push("/home"); router.refresh();
    } catch { setError("ログインに失敗しました"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0a0a0a", position: "relative", overflow: "hidden",
    }}>
      {/* Grid background */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.06,
        backgroundImage: "linear-gradient(rgba(245,158,11,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.3) 1px, transparent 1px)",
        backgroundSize: "50px 50px",
      }} />
      {/* Glow circle */}
      <div style={{
        position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)",
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)",
      }} />
      {/* Scan line */}
      <style>{`@keyframes scanline { 0% { top: -10%; } 100% { top: 110%; } }`}</style>
      <div style={{
        position: "absolute", left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.15), transparent)",
        animation: "scanline 4s linear infinite",
      }} />
      <div style={{
        position: "relative", width: 380,
        background: "rgba(10,10,10,0.9)",
        border: "1px solid rgba(245,158,11,0.2)",
        padding: "40px 32px",
      }}>
        {/* Corner accents */}
        <div style={{ position: "absolute", top: -1, left: -1, width: 20, height: 20, borderTop: "2px solid #d4a017", borderLeft: "2px solid #d4a017" }} />
        <div style={{ position: "absolute", top: -1, right: -1, width: 20, height: 20, borderTop: "2px solid #d4a017", borderRight: "2px solid #d4a017" }} />
        <div style={{ position: "absolute", bottom: -1, left: -1, width: 20, height: 20, borderBottom: "2px solid #d4a017", borderLeft: "2px solid #d4a017" }} />
        <div style={{ position: "absolute", bottom: -1, right: -1, width: 20, height: 20, borderBottom: "2px solid #d4a017", borderRight: "2px solid #d4a017" }} />

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none" style={{ marginBottom: 16 }}>
            <rect x="1" y="1" width="30" height="30" rx="2" fill="none" stroke="#d4a017" strokeWidth="1.5" />
            <rect x="4" y="4" width="24" height="24" rx="1" fill="rgba(245,158,11,0.05)" stroke="#d4a017" strokeWidth="0.5" strokeDasharray="2 1" />
            <text x="16" y="21.5" textAnchor="middle" fontSize="16" fontWeight="900" fill="#d4a017" fontFamily="'Courier New',monospace">C</text>
            <circle cx="6" cy="6" r="1.5" fill="#d4a017" opacity="0.6" />
            <circle cx="26" cy="6" r="1.5" fill="#d4a017" opacity="0.6" />
          </svg>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, alignItems: "baseline" }}>
            <span style={{
              fontSize: 26, fontWeight: 900, letterSpacing: 4,
              fontFamily: "Rajdhani, 'Courier New', sans-serif", color: "#d4a017",
              textShadow: "0 0 12px rgba(245,158,11,0.5)",
            }}>Claude</span>
            <span style={{
              fontSize: 26, fontWeight: 300, letterSpacing: 4,
              fontFamily: "Rajdhani, 'Courier New', sans-serif", color: "rgba(255,255,255,0.4)",
            }}>Cloud</span>
          </div>
          <div style={{ fontSize: 10, letterSpacing: 6, color: "rgba(245,158,11,0.3)", marginTop: 6, fontFamily: "monospace" }}>REAL ESTATE CRM</div>
          <div style={{ width: "100%", height: 1, background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.2), transparent)", margin: "16px 0 0" }} />
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "rgba(245,158,11,0.5)", display: "block", marginBottom: 6, letterSpacing: 3, fontFamily: "monospace" }}>EMAIL</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required
              style={{
                width: "100%", padding: "10px 12px", fontSize: 13, boxSizing: "border-box",
                background: "rgba(245,158,11,0.03)", border: "1px solid rgba(245,158,11,0.15)",
                outline: "none", color: "#d4a017", fontFamily: "monospace",
              }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "rgba(245,158,11,0.5)", display: "block", marginBottom: 6, letterSpacing: 3, fontFamily: "monospace" }}>PASSWORD</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
              style={{
                width: "100%", padding: "10px 12px", fontSize: 13, boxSizing: "border-box",
                background: "rgba(245,158,11,0.03)", border: "1px solid rgba(245,158,11,0.15)",
                outline: "none", color: "#d4a017", fontFamily: "monospace",
              }} />
          </div>
          {error && <div style={{ fontSize: 12, color: "#FCA5A5", background: "rgba(220,38,38,0.1)", padding: "8px 12px", border: "1px solid rgba(220,38,38,0.2)", marginBottom: 16, fontFamily: "monospace" }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "11px", fontSize: 13, fontWeight: 700, letterSpacing: 3,
            background: loading ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.15)",
            color: "#d4a017", border: "1px solid rgba(245,158,11,0.4)",
            cursor: loading ? "not-allowed" : "pointer", fontFamily: "monospace",
            textTransform: "uppercase" as const,
            boxShadow: loading ? "none" : "0 0 15px rgba(245,158,11,0.1)",
          }}>{loading ? "CONNECTING..." : "ACCESS"}</button>
        </form>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: "rgba(255,255,255,0.15)", fontFamily: "monospace", letterSpacing: 2 }}>SYS.2026 // SECURE</div>
      </div>
    </div>
  );
}