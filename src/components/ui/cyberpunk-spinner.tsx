"use client";

export function CyberpunkSpinner({ size = 36 }: { size?: number }) {
  const s = size;
  const bw = s >= 32 ? 3 : 2;
  return (
    <div style={{ position: "relative", width: s, height: s, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, border: `${bw}px solid transparent`, borderTopColor: "#FCEE09", borderRadius: "50%", animation: "cp-spin 0.7s linear infinite" }} />
      <div style={{ position: "absolute", inset: Math.round(s*0.12), border: `${bw}px solid transparent`, borderBottomColor: "#00f0ff", borderRadius: "50%", animation: "cp-spin 1.1s linear infinite reverse" }} />
      <div style={{ position: "absolute", inset: Math.round(s*0.28), border: `${bw}px solid transparent`, borderLeftColor: "#ff003c", borderRadius: "50%", animation: "cp-spin 0.5s linear infinite" }} />
      <div style={{ position: "absolute", width: Math.round(s*0.16), height: Math.round(s*0.16), background: "#FCEE09", borderRadius: "50%", boxShadow: "0 0 8px #FCEE09, 0 0 16px #FCEE09", animation: "cp-pulse 0.8s ease-in-out infinite" }} />
      <style>{`@keyframes cp-spin { to { transform: rotate(360deg); } } @keyframes cp-pulse { 0%,100% { opacity:1; } 50% { opacity:0.2; } }`}</style>
    </div>
  );
}
