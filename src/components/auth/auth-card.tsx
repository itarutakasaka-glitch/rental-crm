"use client";
import type { CSSProperties, ReactNode } from "react";

// ログイン／パスワード設定の各画面で共通の見た目。
// 元のログイン画面のデザインをそのまま関数化したもの（画面が増えても崩れないように）。
export const cardLabel: CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 6,
};

export const cardInput: CSSProperties = {
  width: "100%", padding: "10px 12px", fontSize: 13, boxSizing: "border-box",
  background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, outline: "none", color: "#374151",
};

export const cardError: CSSProperties = {
  fontSize: 12, color: "#dc2626", background: "#fef2f2", padding: "8px 12px",
  border: "1px solid #fecaca", borderRadius: 6, marginBottom: 16,
};

export const cardNotice: CSSProperties = {
  fontSize: 12, color: "#166534", background: "#f0fdf4", padding: "8px 12px",
  border: "1px solid #bbf7d0", borderRadius: 6, marginBottom: 16, lineHeight: 1.7,
};

export function cardButton(loading: boolean): CSSProperties {
  return {
    width: "100%", padding: "11px", fontSize: 14, fontWeight: 700,
    background: loading ? "#e5e7eb" : "#0891b2",
    color: loading ? "#9ca3af" : "#fff", border: "none", borderRadius: 6,
    cursor: loading ? "not-allowed" : "pointer", letterSpacing: 2,
  };
}

export function AuthCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f7f7f8", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: "linear-gradient(rgba(8,145,178,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(8,145,178,0.3) 1px, transparent 1px)",
        backgroundSize: "50px 50px",
      }} />
      <div style={{
        position: "relative", width: 380, background: "#ffffff",
        border: "1px solid #e5e7eb", borderRadius: 8, padding: "40px 32px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}>
        <div style={{ position: "absolute", top: -1, left: -1, width: 20, height: 20, borderTop: "2px solid #0891b2", borderLeft: "2px solid #0891b2", borderRadius: "8px 0 0 0" }} />
        <div style={{ position: "absolute", top: -1, right: -1, width: 20, height: 20, borderTop: "2px solid #0891b2", borderRight: "2px solid #0891b2", borderRadius: "0 8px 0 0" }} />
        <div style={{ position: "absolute", bottom: -1, left: -1, width: 20, height: 20, borderBottom: "2px solid #0891b2", borderLeft: "2px solid #0891b2", borderRadius: "0 0 0 8px" }} />
        <div style={{ position: "absolute", bottom: -1, right: -1, width: 20, height: 20, borderBottom: "2px solid #0891b2", borderRight: "2px solid #0891b2", borderRadius: "0 0 8px 0" }} />
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, alignItems: "baseline" }}>
            <span style={{ fontSize: 26, fontWeight: 500, letterSpacing: 2, color: "#0891b2" }}>heyacules</span>
            <span style={{ fontSize: 26, fontWeight: 500, letterSpacing: 2, color: "#0891b2" }}>cloud</span>
          </div>
          {title && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 10 }}>{title}</div>}
          <div style={{ width: "100%", height: 1, background: "linear-gradient(90deg, transparent, rgba(8,145,178,0.2), transparent)", margin: "16px 0 0" }} />
        </div>
        {children}
      </div>
    </div>
  );
}
