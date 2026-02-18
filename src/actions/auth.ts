"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signInWithEmail(formData: { email: string; password: string }) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
  if (error) return { error: error.message === "Invalid login credentials" ? "メールアドレスまたはパスワードが正しくありません" : error.message };
  return { error: null };
}

export async function signUpWithEmail(formData: { email: string; password: string }) {
  const supabase = await createClient();
  if (formData.password.length < 6) return { error: "パスワードは6文字以上で入力してください" };
  const { error } = await supabase.auth.signUp({ email: formData.email, password: formData.password });
  if (error) return { error: error.message };
  return { error: null, message: "確認メールを送信しました。メールを確認してください。" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
