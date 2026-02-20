"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function ShieldLogo() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 12 }}>
      <defs>
        <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>
        <linearGradient id="innerGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="100%" stopColor="#FEF3C7" />
        </linearGradient>
      </defs>
      <path d="M32 4L8 16v12c0 13.32 8.22 25.78 24 28.8 15.78-3.02 24-15.48 24-28.8V16L32 4z" fill="url(#shieldGrad)" />
      <path d="M32 8L12 18v10c0 11.1 6.84 21.48 20 24 13.16-2.52 20-12.9 20-24V18L32 8z" fill="url(#innerGrad)" />
      <path d="M32 8L12 18v10c0 11.1 6.84 21.48 20 24 13.16-2.52 20-12.9 20-24V18L32 8z" fill="none" stroke="#D97706" strokeWidth="0.5" />
      <text x="32" y="38" textAnchor="middle" fontSize="22" fontWeight="900" fill="#92400E" fontFamily="Georgia,serif">C</text>
      <line x1="20" y1="44" x2="44" y2="44" stroke="#D97706" strokeWidth="1" />
      <line x1="24" y1="47" x2="40" y2="47" stroke="#B45309" strokeWidth="0.5" />
    </svg>
  );
}

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
      background: "linear-gradient(160deg, #1C1917 0%, #292524 40%, #44403C 100%)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background pattern */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.03,
        backgroundImage: "repeating-linear-gradient(45deg, #D97706 0, #D97706 1px, transparent 0, transparent 50%)",
        backgroundSize: "40px 40px",
      }} />
      {/* Glow */}
      <div style={{
        position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)",
        width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(217,119,6,0.08) 0%, transparent 70%)",
      }} />
      <div style={{
        position: "relative", width: 400, background: "rgba(28,25,23,0.85)",
        borderRadius: 16, padding: "48px 36px",
        border: "1px solid rgba(217,119,6,0.2)",
        boxShadow: "0 0 60px rgba(217,119,6,0.08), 0 20px 40px rgba(0,0,0,0.4)",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "center" }}><ShieldLogo /></div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, letterSpacing: 6,
            fontFamily: "Georgia, 'Times New Roman', serif",
            color: "#F59E0B", marginBottom: 4,
            textShadow: "0 0 20px rgba(245,158,11,0.3)",
          }}>CLAVDE</h1>
          <div style={{
            fontSize: 9, letterSpacing: 8, color: "rgba(217,119,6,0.6)",
            fontWeight: 600, textTransform: "uppercase" as const,
          }}>CLOVD · CRM</div>
          <div style={{
            width: 60, height: 1, background: "linear-gradient(90deg, transparent, #D97706, transparent)",
            margin: "16px auto 0",
          }} />
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6, letterSpacing: 2, textTransform: "uppercase" as const }}>EMAIL</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required
              style={{
                width: "100%", padding: "12px 14px", fontSize: 13, boxSizing: "border-box",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(217,119,6,0.2)",
                borderRadius: 8, outline: "none", color: "#fff",
              }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6, letterSpacing: 2, textTransform: "uppercase" as const }}>PASSWORD</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
              style={{
                width: "100%", padding: "12px 14px", fontSize: 13, boxSizing: "border-box",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(217,119,6,0.2)",
                borderRadius: 8, outline: "none", color: "#fff",
              }} />
          </div>
          {error && <div style={{ fontSize: 12, color: "#FCA5A5", background: "rgba(220,38,38,0.15)", padding: "10px 14px", borderRadius: 8, marginBottom: 16, border: "1px solid rgba(220,38,38,0.2)" }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "12px", fontSize: 13, fontWeight: 700, letterSpacing: 2,
            background: loading ? "rgba(217,119,6,0.3)" : "linear-gradient(135deg, #D97706, #B45309)",
            color: "#fff", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: loading ? "none" : "0 4px 16px rgba(217,119,6,0.3)",
            fontFamily: "Georgia, 'Times New Roman', serif",
            textTransform: "uppercase" as const,
          }}>{loading ? "AUTHENTICATING..." : "ENTER"}</button>
        </form>
        <div style={{
          textAlign: "center", marginTop: 24, fontSize: 10, color: "rgba(255,255,255,0.2)",
          letterSpacing: 1,
        }}>MCMXXVI · REAL ESTATE CRM</div>
      </div>
    </div>
  );
}