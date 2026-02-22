"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

interface VisitData {
  setting: {
    closedDays: string;
    availableTimeStart: string;
    availableTimeEnd: string;
    visitMethods: string;
    storeNotice: string;
  };
  organization: {
    id: string; name: string; storeName: string;
    storeAddress: string; storePhone: string; storeHours: string;
  };
  customer?: { id: string; name: string; phone: string };
}

function buildTimeOptions(start: string, end: string) {
  const opts: string[] = [];
  let [h, m] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
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

  // Form state
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,"0")}-${String(tomorrow.getDate()).padStart(2,"0")}`;

  const [visitDate, setVisitDate] = useState(defDate);
  const [visitTime, setVisitTime] = useState("");
  const [visitMethod, setVisitMethod] = useState("");
  const [numGuests, setNumGuests] = useState("1");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [memo, setMemo] = useState("");

  // Override global overflow:hidden
  useEffect(() => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    document.body.style.background = "#ffffff";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.background = "";
    };
  }, []);

  useEffect(() => {
    if (!orgId) return;
    const u = cid ? `/api/public/visit/${orgId}?c=${cid}` : `/api/public/visit/${orgId}`;
    fetch(u).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => {
        setData(d);
        if (d.customer?.phone) setPhone(d.customer.phone);
        // Set default time
        if (d.setting.availableTimeStart) setVisitTime(d.setting.availableTimeStart);
        // Set default method
        const methods = (d.setting.visitMethods || "").split(",").map((s: string) => s.trim()).filter(Boolean);
        if (methods.length > 0) setVisitMethod(methods[0]);
      })
      .catch(() => setError("\u4E88\u7D04\u30DA\u30FC\u30B8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"))
      .finally(() => setLoading(false));
  }, [orgId, cid]);

  async function handleSubmit() {
    if (!phone.trim()) {
      setPhoneError("\u96FB\u8A71\u756A\u53F7\u306F\u5FC5\u9808\u3067\u3059");
      return;
    }
    setPhoneError("");
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/store-visit-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          customerId: cid || undefined,
          phone: phone.trim(),
          visitDate,
          visitTime,
          visitMethod,
          numGuests: parseInt(numGuests),
          memo,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "\u9001\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
      }
    } catch {
      setError("\u9001\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh"}}>
      <p style={{color:"#999"}}>{"\u8AAD\u307F\u8FBC\u307F\u4E2D..."}</p>
    </div>
  );
  if (error && !data) return (
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh"}}>
      <p style={{color:"#999"}}>{error}</p>
    </div>
  );
  if (submitted) return (
    <div style={{minHeight:"100vh",background:"#fff"}}>
      <div style={{background:"#4bbcd2",padding:"14px 20px"}}>
        <span style={{color:"#fff",fontWeight:"bold",fontSize:15}}>{data?.organization.storeName || data?.organization.name}</span>
      </div>
      <div style={{textAlign:"center",padding:"80px 20px"}}>
        <div style={{fontSize:48,marginBottom:12}}>{"\u2705"}</div>
        <h2 style={{fontSize:18,fontWeight:"bold",marginBottom:8}}>{"\u3054\u4E88\u7D04\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059"}</h2>
        <p style={{color:"#666",fontSize:14}}>{"\u62C5\u5F53\u8005\u3088\u308A\u6539\u3081\u3066\u3054\u9023\u7D61\u3044\u305F\u3057\u307E\u3059\u3002"}</p>
      </div>
    </div>
  );
  if (!data) return null;

  const { setting, organization } = data;
  const timeOpts = buildTimeOptions(setting.availableTimeStart || "09:00", setting.availableTimeEnd || "18:00");
  const methods = (setting.visitMethods || "").split(",").map(s => s.trim()).filter(Boolean);

  const labelStyle: React.CSSProperties = { fontWeight: "bold", fontSize: 15, marginBottom: 8, display: "block" };
  const sectionStyle: React.CSSProperties = { marginBottom: 28 };
  const inputStyle: React.CSSProperties = { width: "100%", border: "1px solid #ddd", borderRadius: 4, padding: "12px 14px", fontSize: 15, outline: "none", boxSizing: "border-box" as const };
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: "none" as const, background: "#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23666' fill='none' stroke-width='2'/%3E%3C/svg%3E\") no-repeat right 14px center" };
  const reqBadge = <span style={{display:"inline-block",background:"#e74c3c",color:"#fff",fontSize:11,padding:"1px 6px",borderRadius:3,marginLeft:8,verticalAlign:"middle"}}>{"\u5FC5\u9808"}</span>;
  const optBadge = <span style={{display:"inline-block",background:"#ccc",color:"#fff",fontSize:11,padding:"1px 6px",borderRadius:3,marginLeft:8,verticalAlign:"middle"}}>{"\u4EFB\u610F"}</span>;

  return (
    <div style={{minHeight:"100vh",background:"#fff",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Kaku Gothic ProN',sans-serif"}}>
      {/* Header - Canary Cloud style */}
      <div style={{background:"#4bbcd2",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
        <span style={{color:"#fff",fontWeight:"bold",fontSize:15}}>{organization.storeName || organization.name}</span>
        {organization.storePhone && (
          <a href={`tel:${organization.storePhone}`} style={{color:"#fff",display:"flex",alignItems:"center",gap:6,textDecoration:"none",fontSize:13,fontWeight:"bold"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            {organization.storePhone}
          </a>
        )}
      </div>

      {/* Content */}
      <div style={{maxWidth:800,margin:"0 auto",padding:"32px 20px 40px"}}>

        {/* 1. ご希望の日時 */}
        <div style={sectionStyle}>
          <label style={labelStyle}>{"\u3054\u5E0C\u671B\u306E\u65E5\u6642"}</label>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}>
              <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                style={inputStyle} />
            </div>
            <div style={{flex:1,position:"relative"}}>
              <select value={visitTime} onChange={e => setVisitTime(e.target.value)} style={selectStyle}>
                {timeOpts.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* 2. ご希望の来店方法 */}
        {methods.length > 0 && (
          <div style={sectionStyle}>
            <label style={labelStyle}>{"\u3054\u5E0C\u671B\u306E\u6765\u5E97\u65B9\u6CD5"}</label>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {methods.map(m => (
                <label key={m} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:15}}>
                  <input type="radio" name="visitMethod" checked={visitMethod===m} onChange={() => setVisitMethod(m)}
                    style={{width:20,height:20,accentColor:"#4bbcd2"}} />
                  {m}
                </label>
              ))}
            </div>
            {visitMethod && organization.storeAddress && visitMethod.includes("\u6765\u5E97") && (
              <div style={{marginTop:12,fontSize:14,color:"#555"}}>
                <span>{"\u2192 \u5F53\u65E5\u306F\u4EE5\u4E0B\u306E\u4F4F\u6240\u306B\u304A\u8D8A\u3057\u304F\u3060\u3055\u3044"}</span><br/>
                <a href={`https://www.google.com/maps/search/${encodeURIComponent(organization.storeAddress)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{color:"#4bbcd2",textDecoration:"underline"}}>{organization.storeAddress}</a>
              </div>
            )}
          </div>
        )}

        {/* 3. ご予約人数 */}
        <div style={sectionStyle}>
          <label style={labelStyle}>{"\u3054\u4E88\u7D04\u4EBA\u6570"}</label>
          <div style={{position:"relative"}}>
            <select value={numGuests} onChange={e => setNumGuests(e.target.value)} style={selectStyle}>
              {[1,2,3,4,5].map(n => <option key={n} value={String(n)}>{n}{"\u4EBA"}</option>)}
            </select>
          </div>
        </div>

        {/* 4. 電話番号（必須） */}
        <div style={sectionStyle}>
          <label style={labelStyle}>{"\u96FB\u8A71\u756A\u53F7"}{reqBadge}</label>
          <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setPhoneError(""); }}
            placeholder={"\u96FB\u8A71\u756A\u53F7\uFF08\u4F8B\uFF1A09012345678\uFF09"}
            style={{...inputStyle, borderColor: phoneError ? "#e74c3c" : "#ddd"}} />
          {phoneError && <p style={{color:"#e74c3c",fontSize:13,marginTop:4}}>{phoneError}</p>}
        </div>

        {/* 5. 店舗からのお知らせ */}
        {setting.storeNotice && (
          <div style={sectionStyle}>
            <label style={labelStyle}>{"\u5E97\u8217\u304B\u3089\u306E\u304A\u77E5\u3089\u305B"}</label>
            <div style={{fontSize:14,color:"#333",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{setting.storeNotice}</div>
          </div>
        )}

        {/* 6. 店舗へのご要望（任意） */}
        <div style={sectionStyle}>
          <label style={labelStyle}>{"\u5E97\u8217\u3078\u306E\u3054\u8981\u671B"}{optBadge}</label>
          <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={5}
            placeholder={"\u4F8B\uFF1A\u5F53\u65E5\u306B\u8FFD\u52A0\u3067\u7269\u4EF6\u7D39\u4ECB\u3092\u304A\u9858\u3044\u3057\u307E\u3059"}
            style={{...inputStyle,resize:"vertical"}} />
        </div>

        {/* Error */}
        {error && <p style={{color:"#e74c3c",fontSize:14,textAlign:"center",marginBottom:16}}>{error}</p>}

        {/* Submit button */}
        <button onClick={handleSubmit} disabled={submitting}
          style={{
            width:"100%",padding:"16px",border:"none",borderRadius:4,fontSize:16,fontWeight:"bold",cursor:submitting?"not-allowed":"pointer",
            background: submitting ? "#ccc" : "#b0b0b0",color:"#fff",transition:"background 0.2s",
          }}
          onMouseEnter={e => { if(!submitting) (e.target as HTMLElement).style.background="#4bbcd2"; }}
          onMouseLeave={e => { if(!submitting) (e.target as HTMLElement).style.background="#b0b0b0"; }}
        >
          {submitting ? "\u9001\u4FE1\u4E2D..." : "\u3053\u306E\u5185\u5BB9\u3067\u4E88\u7D04\u3059\u308B"}
        </button>
      </div>
    </div>
  );
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

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

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
      .then(d => { setData(d); if (d.customer?.phone) setPhone(d.customer.phone); })
      .catch(() => setError("\u4E88\u7D04\u30DA\u30FC\u30B8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"))
      .finally(() => setLoading(false));
  }, [orgId, cid]);

  async function handleSubmit() {
    if (!phone.trim()) { setPhoneError("\u96FB\u8A71\u756A\u53F7\u306F\u5FC5\u9808\u3067\u3059"); return; }
    setPhoneError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/store-visit-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          customerId: cid || undefined,
          name: data?.customer?.name || "",
          email: "",
          phone,
          visitDate,
          visitTime,
          visitMethod,
          numGuests: parseInt(numGuests),
          memo,
        }),
      });
      if (res.ok) setSubmitted(true);
      else { const d = await res.json().catch(() => null); setError(d?.error || "\u9001\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F"); }
    } catch { setError("\u9001\u4FE1\u306B\u5931\u6557\u3057\u307E\u3057\u305F"); }
    finally { setSubmitting(false); }
  }

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh" }}>
      <p style={{ color:"#999" }}>{"\u8AAD\u307F\u8FBC\u307F\u4E2D..."}</p>
    </div>
  );
  if (error && !data) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh" }}>
      <p style={{ color:"#999" }}>{error}</p>
    </div>
  );
  if (submitted) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", padding:"20px" }}>
      <div style={{ fontSize:"48px", marginBottom:"16px" }}>{"\u2705"}</div>
      <h2 style={{ fontSize:"18px", fontWeight:"bold", marginBottom:"8px" }}>{"\u3054\u4E88\u7D04\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059"}</h2>
      <p style={{ color:"#666", fontSize:"14px" }}>{"\u62C5\u5F53\u8005\u3088\u308A\u6539\u3081\u3066\u3054\u9023\u7D61\u3044\u305F\u3057\u307E\u3059\u3002"}</p>
    </div>
  );
  if (!data) return null;

  const { setting, organization } = data;
  const timeOpts = buildTimeOptions(setting.availableTimeStart, setting.availableTimeEnd);
  const methods = setting.visitMethods.split(",").map(s => s.trim()).filter(Boolean);
  if (!visitTime && timeOpts.length > 0) setVisitTime(timeOpts[0]);
  if (!visitMethod && methods.length > 0) setVisitMethod(methods[0]);

  const labelStyle: React.CSSProperties = { fontSize:"15px", fontWeight:"bold", marginBottom:"8px", display:"block" };
  const inputStyle: React.CSSProperties = { width:"100%", border:"1px solid #ddd", borderRadius:"4px", padding:"12px 14px", fontSize:"15px", outline:"none", boxSizing:"border-box" as const };
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance:"none" as const, backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat:"no-repeat", backgroundPosition:"right 14px center" };
  const reqBadge = <span style={{ display:"inline-block", fontSize:"11px", color:"#fff", background:"#e53e3e", borderRadius:"3px", padding:"1px 6px", marginLeft:"8px", verticalAlign:"middle" }}>{"\u5FC5\u9808"}</span>;
  const optBadge = <span style={{ display:"inline-block", fontSize:"11px", color:"#888", border:"1px solid #ccc", borderRadius:"3px", padding:"1px 6px", marginLeft:"8px", verticalAlign:"middle" }}>{"\u4EFB\u610F"}</span>;

  return (
    <div style={{ minHeight:"100vh", background:"#fff" }}>
      {/* Header - Canary style cyan */}
      <div style={{ background:"#4fc3c9", color:"#fff", padding:"12px 20px", position:"sticky", top:0, zIndex:10 }}>
        <span style={{ fontSize:"16px", fontWeight:"bold" }}>{organization.storeName || organization.name}</span>
      </div>

      {/* Form body */}
      <div style={{ maxWidth:"800px", margin:"0 auto", padding:"30px 20px 40px" }}>

        {/* 1. Date & Time */}
        <div style={{ marginBottom:"32px" }}>
          <label style={labelStyle}>{"\u3054\u5E0C\u671B\u306E\u65E5\u6642"}</label>
          <div style={{ display:"flex", gap:"12px" }}>
            <div style={{ flex:1 }}>
              <input type="date" value={visitDate} min={todayStr}
                onChange={e => setVisitDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex:1, position:"relative" }}>
              <select value={visitTime} onChange={e => setVisitTime(e.target.value)} style={selectStyle}>
                {timeOpts.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* 2. Visit Method */}
        {methods.length > 0 && (
          <div style={{ marginBottom:"32px" }}>
            <label style={labelStyle}>{"\u3054\u5E0C\u671B\u306E\u6765\u5E97\u65B9\u6CD5"}</label>
            {methods.map(m => (
              <label key={m} style={{ display:"flex", alignItems:"center", padding:"10px 0", cursor:"pointer", fontSize:"15px" }}>
                <input type="radio" name="visitMethod" value={m} checked={visitMethod === m}
                  onChange={() => setVisitMethod(m)}
                  style={{ width:"20px", height:"20px", accentColor:"#4fc3c9", marginRight:"12px" }} />
                {m}
              </label>
            ))}
            {visitMethod && organization.storeAddress && (
              <div style={{ marginTop:"8px", fontSize:"14px", color:"#333" }}>
                <span>{"\u2192 \u5F53\u65E5\u306F\u4EE5\u4E0B\u306E\u4F4F\u6240\u306B\u304A\u8D8A\u3057\u304F\u3060\u3055\u3044"}</span><br/>
                <a href={`https://maps.google.com/?q=${organization.storeAddress}`} target="_blank" rel="noopener"
                  style={{ color:"#4fc3c9", textDecoration:"underline" }}>{organization.storeAddress}</a>
              </div>
            )}
          </div>
        )}

        {/* 3. Number of Guests */}
        <div style={{ marginBottom:"32px" }}>
          <label style={labelStyle}>{"\u3054\u4E88\u7D04\u4EBA\u6570"}</label>
          <div style={{ position:"relative" }}>
            <select value={numGuests} onChange={e => setNumGuests(e.target.value)} style={selectStyle}>
              {[1,2,3,4,5].map(n => <option key={n} value={String(n)}>{n}{"\u4EBA"}</option>)}
            </select>
          </div>
        </div>

        {/* 4. Phone */}
        <div style={{ marginBottom:"32px" }}>
          <label style={labelStyle}>{"\u96FB\u8A71\u756A\u53F7"}{reqBadge}</label>
          <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setPhoneError(""); }}
            placeholder={"\u96FB\u8A71\u756A\u53F7\uFF08\u4F8B\uFF1A09012345678\uFF09"}
            style={{ ...inputStyle, borderColor: phoneError ? "#e53e3e" : "#ddd" }} />
          {phoneError && <p style={{ color:"#e53e3e", fontSize:"13px", marginTop:"4px" }}>{phoneError}</p>}
        </div>

        {/* 5. Store Notice */}
        {setting.storeNotice && (
          <div style={{ marginBottom:"32px" }}>
            <label style={labelStyle}>{"\u5E97\u8217\u304B\u3089\u306E\u304A\u77E5\u3089\u305B"}</label>
            <div style={{ fontSize:"14px", color:"#333", lineHeight:"1.8", whiteSpace:"pre-wrap" }}>{setting.storeNotice}</div>
          </div>
        )}

        {/* 6. Memo */}
        <div style={{ marginBottom:"32px" }}>
          <label style={labelStyle}>{"\u5E97\u8217\u3078\u306E\u3054\u8981\u671B"}{optBadge}</label>
          <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={5}
            placeholder={"\u4F8B\uFF1A\u5F53\u65E5\u306B\u8FFD\u52A0\u3067\u7269\u4EF6\u7D39\u4ECB\u3092\u304A\u9858\u3044\u3057\u307E\u3059"}
            style={{ ...inputStyle, resize:"vertical" }} />
        </div>

        {/* 7. Submit Button */}
        <button onClick={handleSubmit} disabled={submitting}
          style={{ width:"100%", padding:"16px", fontSize:"16px", fontWeight:"bold", color:"#fff",
            background: submitting ? "#ccc" : "#aaa", border:"none", borderRadius:"4px", cursor: submitting ? "default" : "pointer" }}>
          {submitting ? "\u9001\u4FE1\u4E2D..." : "\u3053\u306E\u5185\u5BB9\u3067\u4E88\u7D04\u3059\u308B"}
        </button>

        {error && <p style={{ color:"#e53e3e", fontSize:"14px", textAlign:"center", marginTop:"12px" }}>{error}</p>}
      </div>
    </div>
  );
}
