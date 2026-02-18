"use client";
import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmail, signUpWithEmail } from "@/actions/auth";

function LoginForm() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false); const [error, setError] = useState(""); const [isPending, start] = useTransition();
  const router = useRouter(); const params = useSearchParams(); const redirectTo = params.get("redirect") || "/customers";

  const handleSubmit = () => { setError("");
    start(async () => {
      const res = isSignUp ? await signUpWithEmail(email, password, name) : await signInWithEmail(email, password);
      if (res?.error) setError(res.error); else router.push(redirectTo);
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-[380px]">
        <h1 className="text-xl font-extrabold text-center mb-1">不動産CRM</h1>
        <p className="text-xs text-gray-400 text-center mb-6">{isSignUp ? "アカウント作成" : "ログイン"}</p>
        {error && <div className="mb-3 p-2 bg-red-50 text-red-500 text-xs rounded-lg">{error}</div>}
        <div className="space-y-3">
          {isSignUp && <input value={name} onChange={e => setName(e.target.value)} placeholder="氏名" className="w-full px-4 py-2.5 border rounded-lg text-sm" />}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="メールアドレス" className="w-full px-4 py-2.5 border rounded-lg text-sm" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="パスワード" className="w-full px-4 py-2.5 border rounded-lg text-sm" />
          <button onClick={handleSubmit} disabled={!email || !password || isPending} className="w-full py-2.5 bg-primary text-white rounded-lg font-semibold text-sm disabled:opacity-40">{isPending ? "..." : isSignUp ? "登録" : "ログイン"}</button>
        </div>
        <button onClick={() => setIsSignUp(!isSignUp)} className="w-full text-center text-xs text-gray-400 mt-4">{isSignUp ? "ログインはこちら" : "新規登録はこちら"}</button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-900"><div className="text-white">Loading...</div></div>}><LoginForm /></Suspense>;
}