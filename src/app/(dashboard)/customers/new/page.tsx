"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCustomer } from "@/actions/customer";

export default function NewCustomerPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createCustomer({
        name: fd.get("name") as string,
        nameKana: fd.get("nameKana") as string,
        email: fd.get("email") as string,
        phone: fd.get("phone") as string,
        sourcePortal: fd.get("sourcePortal") as string,
        inquiryContent: fd.get("inquiryContent") as string,
        memo: fd.get("memo") as string,
      });
      if (res?.error) setError(res.error);
      else router.push("/customers");
    });
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-6">新規顧客登録</h1>
      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">顧客名 <span className="text-red-500">*</span></label>
            <input name="name" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="山田太郎" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">フリガナ</label>
            <input name="nameKana" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="ヤマダタロウ" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input name="email" type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="yamada@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
            <input name="phone" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="090-1234-5678" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">反響元</label>
          <select name="sourcePortal" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">選択してください</option>
            <option value="SUUMO">SUUMO</option>
            <option value="HOMES">HOMES</option>
            <option value="at home">at home</option>
            <option value="自社サイト">自社サイト</option>
            <option value="電話">電話</option>
            <option value="来店">来店</option>
            <option value="その他">その他</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">問い合わせ内容</label>
          <textarea name="inquiryContent" rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="問い合わせ内容を入力..."></textarea>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
          <textarea name="memo" rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="メモを入力..."></textarea>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={isPending} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {isPending ? "登録中..." : "登録する"}
          </button>
          <button type="button" onClick={() => router.back()} className="border border-gray-300 px-6 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}

