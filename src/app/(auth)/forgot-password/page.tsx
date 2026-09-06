"use client";
import { useState } from "react";
import { AuthCard, cardInput, cardLabel, cardButton, cardError, cardNotice } from "@/components/auth/auth-card";

// パスワード設定・再設定メールの送信依頼。
// アカウントの有無に関わらず同じ画面を出す（存在確認に使われないように）。
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/request-reset", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      if (res.ok) setSent(true);
      else setError((await res.json().catch(() => ({})))?.error || "送信できませんでした");
    } catch { setError("送信できませんでした"); }
    finally { setLoading(false); }
  };

  return (
    <AuthCard title="パスワードの設定・再設定">
      {sent ? (
        <>
          <div style={cardNotice}>
            入力されたメールアドレスが登録されていれば、設定用のリンクを送信しました。<br />
            メールをご確認ください（リンクの有効期限は1時間です）。
          </div>
          <a href="/login" style={{ display: "block", textAlign: "center", fontSize: 12, color: "#6b7280", textDecoration: "none" }}>ログイン画面に戻る</a>
        </>
      ) : (
        <form onSubmit={submit}>
          <div style={{ marginBottom: 20 }}>
            <label style={cardLabel}>EMAIL</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" style={cardInput} />
          </div>
          {error && <div style={cardError}>{error}</div>}
          <button type="submit" disabled={loading || !email} style={cardButton(loading || !email)}>{loading ? "送信中..." : "設定用リンクを送る"}</button>
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <a href="/login" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}>ログイン画面に戻る</a>
          </div>
        </form>
      )}
    </AuthCard>
  );
}
