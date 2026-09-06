"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard, cardInput, cardLabel, cardButton, cardError } from "@/components/auth/auth-card";

const MIN = 10;

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("確認用のパスワードが一致しません"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || "設定できませんでした"); return; }
      // 設定後はそのままログイン状態になる
      router.push("/inbox");
      router.refresh();
    } catch { setError("設定できませんでした"); }
    finally { setLoading(false); }
  };

  if (!token) {
    return (
      <AuthCard title="パスワードの設定">
        <div style={cardError}>リンクが正しくありません。メールのリンクをもう一度開いてください。</div>
        <a href="/forgot-password" style={{ display: "block", textAlign: "center", fontSize: 12, color: "#0891b2", textDecoration: "none" }}>設定用リンクを再送する</a>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="新しいパスワードを設定">
      <form onSubmit={submit}>
        <div style={{ marginBottom: 16 }}>
          <label style={cardLabel}>NEW PASSWORD（{MIN}文字以上）</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={MIN} autoComplete="new-password" style={cardInput} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={cardLabel}>CONFIRM</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={MIN} autoComplete="new-password" style={cardInput} />
        </div>
        {error && <div style={cardError}>{error}</div>}
        <button type="submit" disabled={loading || password.length < MIN} style={cardButton(loading || password.length < MIN)}>
          {loading ? "設定中..." : "設定してログイン"}
        </button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
