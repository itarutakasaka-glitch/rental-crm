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
      background: "linear-gradient(135deg, #E3F2FD 0%, #F8F9FB 50%, #E8F5E9 100%)",
    }}>
      <div style={{ width: 380, background: "#fff", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: "40px 32px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#29B6F6", marginBottom: 4, letterSpacing: 1 }}>Claude Cloud</h1>
          <p style={{ fontSize: 12, color: "#9ca3af" }}>不動産CRM</p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>メールアドレス</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required
              style={{ width: "100%", padding: "10px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>パスワード</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワードを入力" required
              style={{ width: "100%", padding: "10px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, outline: "none", boxSizing: "border-box" }} />
          </div>
          {error && <div style={{ fontSize: 12, color: "#DC2626", background: "#FEE2E2", padding: "8px 12px", borderRadius: 6, marginBottom: 14 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "10px", fontSize: 14, fontWeight: 600,
            background: loading ? "#93C5FD" : "linear-gradient(90deg, #4FC3F7, #29B6F6)",
            color: "#fff", border: "none", borderRadius: 6, cursor: loading ? "not-allowed" : "pointer",
          }}>{loading ? "ログイン中..." : "ログイン"}</button>
        </form>
      </div>
    </div>
  );
}