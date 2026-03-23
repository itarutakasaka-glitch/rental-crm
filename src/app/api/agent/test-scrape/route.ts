import { NextRequest, NextResponse } from "next/server";

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_API_TOKEN || "";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!url) return NextResponse.json({ error: "url param required" });
  if (!BROWSERLESS_TOKEN) return NextResponse.json({ error: "BROWSERLESS_API_TOKEN not set" });

  try {
    const scrapeRes = await fetch(`https://production-sfo.browserless.io/scrape?token=${BROWSERLESS_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        waitForSelector: { selector: "body", timeout: 8000 },
        elements: [{ selector: "body" }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!scrapeRes.ok) return NextResponse.json({ error: `Browserless HTTP ${scrapeRes.status}` });
    const scrapeData = await scrapeRes.json();
    const bodyText = scrapeData?.data?.[0]?.results?.[0]?.text || "";
    const text = bodyText.replace(/\s+/g, " ").slice(0, 15000);

    const nyM = text.match(/\u5165\u5C45\s+(.{1,30})/);
    const nyukyo = nyM ? nyM[1].trim() : "NOT_FOUND";
    const cnM = text.match(/\u7BC9\u5E74\u6570\s+(\S+)/);
    const chikuNensu = cnM ? cnM[1].trim() : "NOT_FOUND";
    const cmM = text.match(/\u7BC9\u5E74\u6708\s+(\d{4})\u5E74(\d{1,2})\u6708/);
    const chikuNengetsu = cmM ? `${cmM[1]}/${cmM[2]}` : "NOT_FOUND";
    const hasEnd = /\u639B\u8F09\u7D42\u4E86|\u63B2\u8F09\u671F\u9593\u304C\u7D42\u4E86|\u53D6\u308A\u6271\u3044\u7D42\u4E86/.test(text);
    const sample = text.slice(0, 300);
    return NextResponse.json({ nyukyo, chikuNensu, chikuNengetsu, pageLen: text.length, hasEnd, sample });
  } catch (e: any) {
    return NextResponse.json({ error: e.message?.slice(0, 100) || "unknown" });
  }
}
