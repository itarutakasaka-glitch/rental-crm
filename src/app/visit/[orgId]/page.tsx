"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

interface VisitData {
  setting: { closedDays: string; availableTimeStart: string; availableTimeEnd: string; visitMethods: string; storeNotice: string; };
  organization: { id: string; name: string; storeName: string; storeAddress: string; storePhone: string; storeHours: string; };
  customer?: { id: string; name: string; phone: string; };
}

function buildTimeOptions(start: string, end: string) {
  const opts: string[] = [];
  let [h, m] = (start || "09:00").split(":").map(Number);
  const [eh, em] = (end || "18:00").split(":").map(Number);
  while (h < eh || (h === eh && m <= em)) {
    opts.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    m += 30; if (m >= 60) { h++; m = 0; }
  }
  return opts;
}

export default function PublicVisitPage() {
  const params = useParams();
  const sp = useSearchParams();
  const orgId = params.orgId as string;
  const cid = sp.get("c") || "";

  const [data, setData] = useState<VisitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const [visitDate, setVisitDate] = useState(todayStr);
  const [visitTime, setVisitTime] = useState("");
  const [visitMethod, setVisitMethod] = useState("");
  const [numGuests, setNumGuests] = useState("1");
  const [phone, setPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    return () => { document.documentElement.style.overflow = ""; document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (!orgId) return;
    const u = cid ? `/api/public/visit/${orgId}?c=${cid}` : `/api/public/visit/${orgId}`;
    fetch(u).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: VisitData) => {
        setData(d);
        if (d.customer?.phone) setPhone(d.customer.phone);
        const t = buildTimeOptions(d.setting.availableTimeStart, d.setting.availableTimeEnd);
        if (t.length > 0) setVisitTime(t[0]);
        const m = (d.setting.visitMethods || "").split(",").map(s => s.trim()).filter(Boolean);
        if (m.length > 0) setVisitMethod(m[0]);
      })
      .catch(() => setError("\u4E88\u7D04\u30DA\u30FC\u30B8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"))
      .finally(() => setLoading(false));
  }, [orgId, cid]);

  async function handleSubmit() {
    if (!phone.trim()) { setPhoneError("\u96FB\u8A71\u756A\u53F7\u306F\u5FC5\u9808\u3067\u3059"); return; }
    setPhoneError(""); setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/store-visit-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, customerId: cid || undefined, name: data?.customer?.name || "", email: "", phone, visitDate, visitTime, visitMethod, numGuests: parseInt(numGuests), memo }),
      });
      if (res.ok) setSubmitted(true);
      else { const d = await res.json().catch(() => null); setError(d?.error || "\u9001\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F"); }
    } catch { setError("\u9001\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F"); }
    finally { setSubmitting(false); }
  }

  // Loading
  if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"}}><p style={{color:"#999"}}>{"\u8AAD\u307F\u8FBC\u307F\u4E2D..."}</p></div>;
  // Error (no data)
  if (error && !data) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"}}><p style={{color:"#999"}}>{error}</p></div>;
  if (!data) return null;

  // Success
  if (submitted) return (
    <div style={{minHeight:"100dvh",background:"#fff",display:"flex",flexDirection:"column"}}>
      <div style={{background:"#4bbcd2",padding:"14px 20px"}}><span style={{color:"#fff",fontWeight:"bold",fontSize:15}}>{data?.organization?.storeName || data?.organization?.name || ""}</span></div>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px"}}>
        <div style={{width:80,height:80,borderRadius:"50%",background:"#e8f8f5",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20}}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4bbcd2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 style={{fontSize:20,fontWeight:"bold",marginBottom:10,color:"#333"}}>{"\u3054\u4E88\u7D04\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059"}</h2>
        <p style={{color:"#666",fontSize:14,textAlign:"center",lineHeight:1.8}}>{"\u62C5\u5F53\u8005\u3088\u308A\u6539\u3081\u3066\u3054\u9023\u7D61\u3044\u305F\u3057\u307E\u3059\u3002"}</p>
        <div style={{marginTop:24,padding:"16px 24px",background:"#f7f7f8",borderRadius:8,fontSize:14,color:"#555",textAlign:"center",lineHeight:1.8}}>
          <div>{visitDate.replace(/-/g, "/")} {visitTime}</div>
          {visitMethod && <div>{visitMethod}</div>}
        </div>
      </div>
    </div>
  );

  const { setting, organization } = data;
  const timeOpts = buildTimeOptions(setting.availableTimeStart, setting.availableTimeEnd);
  const methods = (setting.visitMethods || "").split(",").map(s => s.trim()).filter(Boolean);

  const S = {
    label: { fontWeight: "bold" as const, fontSize: 15, marginBottom: 8, display: "block" as const },
    section: { marginBottom: 28 },
    input: { width: "100%", border: "1px solid #ddd", borderRadius: 4, padding: "12px 14px", fontSize: 15, outline: "none", boxSizing: "border-box" as const },
    select: { width: "100%", border: "1px solid #ddd", borderRadius: 4, padding: "12px 14px", fontSize: 15, outline: "none", boxSizing: "border-box" as const, appearance: "none" as const, background: "#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23999' fill='none' stroke-width='2'/%3E%3C/svg%3E\") no-repeat right 14px center" },
  };
  const reqBadge = <span style={{display:"inline-block",background:"#e74c3c",color:"#fff",fontSize:11,padding:"1px 6px",borderRadius:3,marginLeft:8,verticalAlign:"middle"}}>{"\u5FC5\u9808"}</span>;
  const optBadge = <span style={{display:"inline-block",border:"1px solid #ccc",color:"#888",fontSize:11,padding:"1px 5px",borderRadius:3,marginLeft:8,verticalAlign:"middle"}}>{"\u4EFB\u610F"}</span>;

  return (
    <div style={{minHeight:"100vh",background:"#fff",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Kaku Gothic ProN',sans-serif"}}>
      {/* Header */}
      <div style={{background:"#4bbcd2",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
        <span style={{color:"#fff",fontWeight:"bold",fontSize:15}}>{organization.storeName || organization.name}</span>
        {organization.storePhone && (
          <a href={`tel:${organization.storePhone}`} style={{color:"#fff",display:"flex",alignItems:"center",gap:6,textDecoration:"none",fontSize:13,fontWeight:"bold"}}>
            {"\u260E "}{organization.storePhone}
          </a>
        )}
      </div>

      <div style={{maxWidth:800,margin:"0 auto",padding:"32px 20px 40px"}}>

        {/* 1. ご希望の日時 */}
        <div style={S.section}>
          <label style={S.label}>{"\u3054\u5E0C\u671B\u306E\u65E5\u6642"}</label>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}>
              <input type="date" value={visitDate} min={todayStr} onChange={e => { if (e.target.value >= todayStr) setVisitDate(e.target.value); }} style={S.input} />
            </div>
            <div style={{flex:1}}>
              <select value={visitTime} onChange={e => setVisitTime(e.target.value)} style={S.select}>
                {timeOpts.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* 2. ご希望の来店方法 */}
        {methods.length > 0 && (
          <div style={S.section}>
            <label style={S.label}>{"\u3054\u5E0C\u671B\u306E\u6765\u5E97\u65B9\u6CD5"}</label>
            {methods.map(m => (
              <label key={m} style={{display:"flex",alignItems:"center",padding:"10px 0",cursor:"pointer",fontSize:15}}>
                <input type="radio" name="vm" checked={visitMethod===m} onChange={() => setVisitMethod(m)} style={{width:20,height:20,accentColor:"#4bbcd2",marginRight:10}} />
                {m}
              </label>
            ))}
            {visitMethod && organization.storeAddress && visitMethod.includes("\u6765\u5E97") && (
              <div style={{marginTop:8,fontSize:14,color:"#555"}}>
                {"\u2192 \u5F53\u65E5\u306F\u4EE5\u4E0B\u306E\u4F4F\u6240\u306B\u304A\u8D8A\u3057\u304F\u3060\u3055\u3044"}<br/>
                <a href={`https://www.google.com/maps/search/${encodeURIComponent(organization.storeAddress)}`} target="_blank" rel="noopener noreferrer" style={{color:"#4bbcd2",textDecoration:"underline"}}>{organization.storeAddress}</a>
              </div>
            )}
          </div>
        )}

        {/* 3. ご予約人数 */}
        <div style={S.section}>
          <label style={S.label}>{"\u3054\u4E88\u7D04\u4EBA\u6570"}</label>
          <select value={numGuests} onChange={e => setNumGuests(e.target.value)} style={S.select}>
            {[1,2,3,4,5].map(n => <option key={n} value={String(n)}>{n}{"\u4EBA"}</option>)}
          </select>
        </div>

        {/* 4. 電話番号 必須 */}
        <div style={S.section}>
          <label style={S.label}>{"\u96FB\u8A71\u756A\u53F7"}{reqBadge}</label>
          <input type="tel" value={phone} onChange={e => {setPhone(e.target.value);setPhoneError("");}}
            placeholder={"\u96FB\u8A71\u756A\u53F7\uFF08\u4F8B\uFF1A09012345678\uFF09"}
            style={{...S.input, borderColor: phoneError ? "#e74c3c" : "#ddd"}} />
          {phoneError && <p style={{color:"#e74c3c",fontSize:13,marginTop:4}}>{phoneError}</p>}
        </div>

        {/* 5. 店舗からのお知らせ */}
        {setting.storeNotice && (
          <div style={S.section}>
            <label style={S.label}>{"\u5E97\u8217\u304B\u3089\u306E\u304A\u77E5\u3089\u305B"}</label>
            <div style={{fontSize:14,color:"#333",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{setting.storeNotice}</div>
          </div>
        )}

        {/* 6. 店舗へのご要望 任意 */}
        <div style={S.section}>
          <label style={S.label}>{"\u5E97\u8217\u3078\u306E\u3054\u8981\u671B"}{optBadge}</label>
          <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={5}
            placeholder={"\u4F8B\uFF1A\u5F53\u65E5\u306B\u8FFD\u52A0\u3067\u7269\u4EF6\u7D39\u4ECB\u3092\u304A\u9858\u3044\u3057\u307E\u3059"}
            style={{...S.input, resize:"vertical" as const}} />
        </div>

        {/* Error */}
        {error && <p style={{color:"#e74c3c",fontSize:14,textAlign:"center",marginBottom:16}}>{error}</p>}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={submitting}
          style={{width:"100%",padding:"16px",border:"none",borderRadius:4,fontSize:16,fontWeight:"bold",
            cursor:submitting?"not-allowed":"pointer",
            background:submitting?"#ccc":"#4bbcd2",color:"#fff"}}>
          {submitting ? "\u9001\u4FE1\u4E2D..." : "\u3053\u306E\u5185\u5BB9\u3067\u4E88\u7D04\u3059\u308B"}
        </button>

      </div>
    </div>
  );
}
