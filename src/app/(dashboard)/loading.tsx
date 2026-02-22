"use client";
import { CyberpunkSpinner } from "@/components/ui/cyberpunk-spinner";

export default function DashboardLoading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, minHeight: 300 }}>
      <CyberpunkSpinner size={40} />
    </div>
  );
}
