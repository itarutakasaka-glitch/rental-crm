"use client";
import { useState, useEffect, useCallback } from "react";

interface Props {
  customerId: string;
  customerName: string;
  customerEmail?: string;
  onMessageSent?: () => void;
}

export default function PropertySuggestion({ customerId, customerName, customerEmail, onMessageSent }: Props) {
  const [pref, setPref] = useState<any>({});
  const [properties, setProperties] = useState<any[]>([]);
  const [allCount, setAllCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());

  const layouts = ["1R","1K","1DK","1LDK","2K","2DK","2LDK","3K","3DK","3LDK","4K","4DK","4LDK"];

  const fetchPref = useCallback(async () => {
    try {
      const res = await fetch("/api/customers/preference?customerId=" + customerId);
      if (res.ok) {
        const d = await res.json();
        if (d) {
          setPref({
            ...d,
            selectedLayouts: d.layout ? d.layout.split(",") : [],
          });
        }
      }
    } catch (e) { console.error(e); }
  }, [customerId]);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/properties?customerId=" + customerId);
      if (res.ok) {
        const d = await res.json();
        setProperties(d.properties || []);
        setAllCount(d.properties?.length || 0);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [customerId]);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/properties");
      if (res.ok) {
        const d = await res.json();
        const all = d.properties || d || [];
        setProperties(all);
        setAllCount(all.length);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchPref();
  }, [fetchPref]);

  useEffect(() => {
    const hasPref = pref.id;
    if (hasPref) { fetchProperties(); } else { fetchAll(); }
  }, [pref.id]);

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try {
      const body = {
        customerId,
        area: pref.area || null,
        station: pref.station || null,
        walkMinutes: pref.walkMinutes ? parseInt(pref.walkMinutes) : null,
        layout: (pref.selectedLayouts || []).join(",") || null,
        rentMin: pref.rentMin ? parseInt(pref.rentMin) : null,
        rentMax: pref.rentMax ? parseInt(pref.rentMax) : null,
        areaMin: pref.areaMin ? parseFloat(pref.areaMin) : null,
        moveInDate: pref.moveInDate || null,
        note: pref.note || null,
        petOk: !!pref.petOk,
        autoLock: !!pref.autoLock,
        bathToiletSeparate: !!pref.bathToiletSeparate,
        flooring: !!pref.flooring,
        aircon: !!pref.aircon,
        reheating: !!pref.reheating,
        washletToilet: !!pref.washletToilet,
        freeInternet: !!pref.freeInternet,
      };
      const res = await fetch("/api/customers/preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const d = await res.json();
        setPref({ ...d, selectedLayouts: d.layout ? d.layout.split(",") : [] });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        fetchProperties();
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const toggleLayout = (l: string) => {
    const cur = pref.selectedLayouts || [];
    const next = cur.includes(l) ? cur.filter((x: string) => x !== l) : [...cur, l];
    setPref({ ...pref, selectedLayouts: next });
  };

  const handleSendProperty = async (prop: any) => {
    setSending(prop.id);
    try {
      const subject = "\u7269\u4EF6\u306E\u3054\u63D0\u6848: " + prop.name + (prop.roomNumber ? " " + prop.roomNumber : "");
      const body = customerName + "\u69D8\n\n\u304A\u4E16\u8A71\u306B\u306A\u3063\u3066\u304A\u308A\u307E\u3059\u3002\n\u3054\u5E0C\u671B\u306B\u5408\u3044\u305D\u3046\u306A\u7269\u4EF6\u304C\u3054\u3056\u3044\u307E\u3057\u305F\u306E\u3067\u3054\u6848\u5185\u3044\u305F\u3057\u307E\u3059\u3002\n\n\u25A0 " + prop.name + (prop.roomNumber ? " " + prop.roomNumber : "") + "\n\u8CC3\u6599: " + (prop.rent / 10000).toFixed(1) + "\u4E07\u5186" + (prop.managementFee ? " / \u7BA1\u7406\u8CBB " + (prop.managementFee / 10000).toFixed(1) + "\u4E07\u5186" : "") + "\n" + (prop.address || "") + "\n" + (prop.station || "") + (prop.walkMinutes ? " \u5F92\u6B69" + prop.walkMinutes + "\u5206" : "") + "\n" + (prop.layout || "") + " / " + (prop.area || "") + "m\u00B2\n" + (prop.url ? "\u8A73\u7D30: " + prop.url : "") + "\n\n\u3054\u5185\u898B\u3092\u3054\u5E0C\u671B\u306E\u5834\u5408\u306F\u304A\u6C17\u8EFD\u306B\u3054\u9023\u7D61\u304F\u3060\u3055\u3044\u3002";
      const res = await fetch("/api/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, subject, body, channel: "EMAIL" }),
      });
      if (res.ok) {
        setSent(prev => new Set(prev).add(prop.id));
        onMessageSent?.();
      }
    } catch (e) { console.error(e); }
    finally { setSending(null); }
  };

  const filtered = search
    ? properties.filter(p => p.name?.includes(search) || p.address?.includes(search) || p.station?.includes(search))
    : properties;

  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 12, outline: "none" };

  return (
    <div style={{ display: "flex", height: "100%", gap: 0, background: "#f9fafb" }}>
      {/* Left: Preference Panel */}
      <div style={{ width: 220, minWidth: 220, background: "#fff", borderRight: "1px solid #e5e7eb", overflowY: "auto", padding: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{"\u5E0C\u671B\u6761\u4EF6"}</span>
          {saved && <span style={{ fontSize: 11, color: "#16a34a" }}>{"\u2705 \u4FDD\u5B58\u6E08"}</span>}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>{"\u5165\u5C45\u5E0C\u671B\u6642\u671F"}</div>
          <input style={inputStyle} placeholder={"\u4F8B: 3\u6708\u4E0B\u65EC"} value={pref.moveInDate || ""} onChange={e => setPref({...pref, moveInDate: e.target.value})} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>{"\u5E0C\u671B\u30A8\u30EA\u30A2"}</div>
          <input style={inputStyle} placeholder={"\u4F8B: \u591A\u6469\u5E02, \u8ABF\u5E03\u5E02"} value={pref.area || ""} onChange={e => setPref({...pref, area: e.target.value})} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>{"\u99C5\u30FB\u8DEF\u7DDA"}</div>
          <input style={inputStyle} placeholder={"\u4F8B: \u4EAC\u738B\u7DDA\u8ABF\u5E03\u99C5"} value={pref.station || ""} onChange={e => setPref({...pref, station: e.target.value})} />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>{"\u8CC3\u6599"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input type="number" style={{...inputStyle, width: "auto"}} placeholder={"\u4E0B\u9650"} value={pref.rentMin || ""} onChange={e => setPref({...pref, rentMin: e.target.value})} />
              <span style={{ fontSize: 11, color: "#6b7280" }}>~</span>
              <input type="number" style={{...inputStyle, width: "auto"}} placeholder={"\u4E0A\u9650"} value={pref.rentMax || ""} onChange={e => setPref({...pref, rentMax: e.target.value})} />
              <span style={{ fontSize: 10, color: "#6b7280", whiteSpace: "nowrap" }}>{"\u4E07\u5186"}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>{"\u9762\u7A4D"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input type="number" style={{...inputStyle, width: "auto"}} placeholder="" value={pref.areaMin || ""} onChange={e => setPref({...pref, areaMin: e.target.value})} />
              <span style={{ fontSize: 10, color: "#6b7280" }}>m{"\u00B2"}{"\u4EE5\u4E0A"}</span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>{"\u9593\u53D6\u308A"}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {layouts.map(l => (
              <label key={l} style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 11, cursor: "pointer", padding: "2px 6px", borderRadius: 3, background: (pref.selectedLayouts || []).includes(l) ? "rgba(212,160,23,0.15)" : "#f3f4f6", border: (pref.selectedLayouts || []).includes(l) ? "1px solid #d4a017" : "1px solid #e5e7eb" }}>
                <input type="checkbox" checked={(pref.selectedLayouts || []).includes(l)} onChange={() => toggleLayout(l)} style={{ display: "none" }} />
                {l}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>{"\u99C5\u5F92\u6B69"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input type="number" style={{...inputStyle, width: "auto"}} value={pref.walkMinutes || ""} onChange={e => setPref({...pref, walkMinutes: e.target.value})} />
              <span style={{ fontSize: 10, color: "#6b7280", whiteSpace: "nowrap" }}>{"\u5206\u4EE5\u5185"}</span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>{"\u3053\u3060\u308F\u308A\u6761\u4EF6"}</div>
          {[
            { k: "petOk", label: "\u30DA\u30C3\u30C8\u53EF" },
            { k: "autoLock", label: "\u30AA\u30FC\u30C8\u30ED\u30C3\u30AF" },
            { k: "bathToiletSeparate", label: "\u30D0\u30B9\u30FB\u30C8\u30A4\u30EC\u5225" },
            { k: "flooring", label: "\u30D5\u30ED\u30FC\u30EA\u30F3\u30B0" },
            { k: "aircon", label: "\u30A8\u30A2\u30B3\u30F3" },
            { k: "reheating", label: "\u8FFD\u3044\u7119\u304D" },
            { k: "freeInternet", label: "\u30CD\u30C3\u30C8\u7121\u6599" },
          ].map(item => (
            <label key={item.k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer", padding: "3px 0" }}>
              <input type="checkbox" checked={!!pref[item.k]} onChange={e => setPref({...pref, [item.k]: e.target.checked})} />
              {item.label}
            </label>
          ))}
        </div>

        <button onClick={handleSave} disabled={saving} style={{
          width: "100%", padding: "8px 0", border: "none", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer",
          background: saving ? "#d1d5db" : "#d4a017", color: "#fff", fontSize: 13, fontWeight: 600,
        }}>{saving ? "\u4FDD\u5B58\u4E2D..." : "\u2705 \u5E0C\u671B\u6761\u4EF6\u3092\u4FDD\u5B58\u30FB\u53CD\u6620"}</button>
      </div>

      {/* Right: Property Cards */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
            {"\u63D0\u6848\u53EF\u80FD\u7269\u4EF6"}: <span style={{ color: "#d4a017" }}>{filtered.length}</span>{"\u4EF6"}
          </div>
          <div style={{ position: "relative" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={"\u7269\u4EF6\u540D\u3067\u691C\u7D22"} style={{ padding: "5px 8px 5px 28px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 12, width: 180 }} />
            <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#9ca3af" }}>{"\uD83D\uDD0D"}</span>
          </div>
        </div>

        {loading && (<div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ display: "inline-block" }}>
                <div style={{
                  width: 36, height: 36, border: "3px solid rgba(212,160,23,0.15)",
                  borderTop: "3px solid #d4a017", borderRadius: "50%",
                  animation: "cpspin 0.7s linear infinite",
                  boxShadow: "0 0 10px rgba(212,160,23,0.3), inset 0 0 10px rgba(212,160,23,0.1)",
                }} />
                <style>{`@keyframes cpspin { to { transform: rotate(360deg); } }`}</style>
              </div>
              <div style={{ fontSize: 12, color: "#d4a017", marginTop: 8, letterSpacing: 2 }}>SCANNING...</div>
            </div>)}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontSize: 13 }}>
            {"\u6761\u4EF6\u306B\u5408\u3046\u7269\u4EF6\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F"}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((p: any) => (
            <div key={p.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              {/* Property Image */}
              <div style={{ width: "100%", height: 60, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <>
                    <span style={{ fontSize: 32 }}>{"\uD83C\uDFE0"}</span>
                    <span style={{ fontSize: 9, color: "#9ca3af", marginTop: 4 }}>No Image</span>
                  </>
                )}
              </div>

              {/* Property Info */}
              <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      {p.isAvailable && <span style={{ fontSize: 9, background: "#0891b2", color: "#fff", padding: "1px 6px", borderRadius: 3, marginRight: 6 }}>{"\u52DF\u96C6\u4E2D"}</span>}
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{p.name}</span>
                      {p.roomNumber && <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 4 }}>{p.roomNumber}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#d4a017", marginTop: 4 }}>
                    {(p.rent / 10000).toFixed(1)}{"\u4E07\u5186"}
                    {p.managementFee > 0 && <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 400, marginLeft: 4 }}>{"\u7BA1\u7406\u8CBB "}{(p.managementFee / 10000).toFixed(1)}{"\u4E07\u5186"}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.5 }}>
                    {p.address && <div>{p.address}</div>}
                    <div>
                      {p.station && <span>{p.station}</span>}
                      {p.walkMinutes && <span>{" \u5F92\u6B69"}{p.walkMinutes}{"\u5206"}</span>}
                      {p.layout && <span style={{ marginLeft: 8 }}>{p.layout}</span>}
                      {p.area && <span>{" / "}{p.area}m{"\u00B2"}</span>}
                      {p.floor && <span>{" / "}{p.floor}</span>}
                      {p.age != null && <span style={{ marginLeft: 8 }}>{"\u7BC9"}{p.age}{"\u5E74"}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                  {sent.has(p.id) ? (
                    <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>{"\u2705 \u9001\u4FE1\u6E08"}</span>
                  ) : (
                    <button
                      onClick={() => handleSendProperty(p)}
                      disabled={sending === p.id || !customerEmail}
                      style={{
                        padding: "4px 12px", border: "1px solid #d4a017", borderRadius: 4, background: "#fff",
                        color: "#d4a017", fontSize: 11, fontWeight: 600, cursor: sending === p.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {sending === p.id ? "SENDING..." : "\u3053\u306E\u7269\u4EF6\u3092\u9001\u308B"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}