"use client";
import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmail, signUpWithEmail } from "@/actions/auth";

export default function LoginPage() {
  const [email, setEmail] = useState(""); const [pass, setPass] = useState("");
  const [mode, setMode] = useState<"login"|"signup">("login");
  const [error, setError] = useState<string|null>(null); const [msg, setMsg] = useState<string|null>(null);
  const [isPending, start] = useTransition(); const router = useRouter(); const params = useSearchParams();

  const handleSubmit = () => { setError(null); setMsg(null);
    start(async () => {
      if (mode === "login") {
        const r = await signInWithEmail({ email, password: pass });
        if (r.error) setError(r.error); else router.push(params.get("redirect") || "/customers");
      } else {
        const r = await signUpWithEmail({ email, password: pass });
        if (r.error) setError(r.error); else setMsg(r.message || "登録完了");
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-[360px]">
        <div className="text-center mb-7">
          <div className="inline-flex w-12 h-12 bg-primary/20 rounded-2xl items-center justify-center mb-2"><span className="text-2xl font-black text-primary">不</span></div>
          <h1 className="text-xl font-extrabold text-white">不動産CRM</h1>
          <p className="text-xs text-gray-500 mt-1">賃貸仲介管理システム</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-xl">
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setMode("login")} className={`flex-1 py-1.5 rounded-md text-sm font-medium ${mode === "login" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>ログイン</button>
            <button onClick={() => setMode("signup")} className={`flex-1 py-1.5 rounded-md text-sm font-medium ${mode === "signup" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>新規登録</button>
          </div>
          {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">{error}</div>}
          {msg && <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-600">{msg}</div>}
          <div className="space-y-3">
            <div><label className="text-xs text-gray-500 block mb-1">メールアドレス</label><input value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">パスワード</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm" /></div>
            <button onClick={handleSubmit} disabled={isPending} className="w-full py-2.5 bg-primary text-white rounded-lg font-semibold text-sm disabled:opacity-50">{isPending ? "処理中..." : mode === "login" ? "ログイン" : "新規登録"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
