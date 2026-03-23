import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!url) return NextResponse.json({ error: "url param required" });
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    clearTimeout(timeout);
    if (!res.ok) return NextResponse.json({ httpStatus: res.status, pattern: "F_or_error" });
    const html = await res.text();
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 15000);
    const nyM = text.match(/\u5165\u5C45\s+(.{1,30})/);
    const nyukyo = nyM ? nyM[1].trim() : "NOT_FOUND";
    const cnM = text.match(/\u7BC9\u5E74\u6570\s+(\S+)/);
    const chikuNensu = cnM ? cnM[1].trim() : "NOT_FOUND";
    const cmM = text.match(/\u7BC9\u5E74\u6708\s+(\d{4})\u5E74(\d{1,2})\u6708/);
    const chikuNengetsu = cmM ? `${cmM[1]}/${cmM[2]}` : "NOT_FOUND";
    const pageLen = text.length;
    const hasEnd = /\u639B\u8F09\u7D42\u4E86|\u63B2\u8F09\u671F\u9593\u304C\u7D42\u4E86|\u53D6\u308A\u6271\u3044\u7D42\u4E86/.test(text);
    return NextResponse.json({ nyukyo, chikuNensu, chikuNengetsu, pageLen, hasEnd, httpStatus: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message?.slice(0, 100) || "unknown" });
  }
}
