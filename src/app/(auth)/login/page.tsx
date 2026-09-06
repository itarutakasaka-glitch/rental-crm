"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthCard, cardInput, cardLabel, cardButton, cardError } from "@/components/auth/auth-card";

// 2026-09-06: Supabase Auth から自前認証へ移行。/api/auth/login にPOSTする。
function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setNeedsSetup(false);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "ログインに失敗しました");
        setNeedsSetup(!!data?.needsSetup);
        return;
      }
      const redirect = params.get("redirect");
      router.push(redirect && redirect.startsWith("/") ? redirect : "/inbox");
      router.refresh();
    } catch {
      setError("ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 16 }}>
          <label style={cardLabel}>EMAIL</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" style={cardInput} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={cardLabel}>PASSWORD</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" style={cardInput} />
        </div>
        {error && (
          <div style={cardError}>
            {error}
            {needsSetup && (
              <div style={{ marginTop: 6 }}>
                <a href="/forgot-password" style={{ color: "#0891b2", fontWeight: 700 }}>パスワードを設定する</a>
              </div>
            )}
          </div>
        )}
        <button type="submit" disabled={loading} style={cardButton(loading)}>{loading ? "CONNECTING..." : "ACCESS"}</button>
      </form>
      <div style={{ marginTop: 16, textAlign: "center" }}>
        <a href="/forgot-password" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}>パスワードを忘れた方・初めての方</a>
      </div>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
