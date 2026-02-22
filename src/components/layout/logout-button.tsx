"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button onClick={handleLogout} disabled={loading} style={{
      padding: "4px 12px", fontSize: 11, fontWeight: 500,
      background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
      color: "#dc2626", borderRadius: 4, cursor: loading ? "not-allowed" : "pointer",
      fontFamily: "monospace", letterSpacing: 1,
    }}>
      {loading ? "..." : "LOGOUT"}
    </button>
  );
}