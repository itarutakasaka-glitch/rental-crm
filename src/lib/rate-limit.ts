// implementation-spec-v1.md §3/§7: 公開route(P)の簡易レート制限(IPあたり N回/分)。
// サーバレスではインスタンスごとのメモリなので厳密ではないが、単一インスタンスからの連打を止める。
// 恒久策は Vercel WAF / Upstash 等の外部ストア(D-2 で検討)。
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit = 10, windowMs = 60_000): { ok: boolean; remaining: number } {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return { ok: false, remaining: 0 };
  }
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 5000) {
    // メモリ肥大防止: 古いキーを間引く
    for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
  return { ok: true, remaining: limit - arr.length };
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
}
