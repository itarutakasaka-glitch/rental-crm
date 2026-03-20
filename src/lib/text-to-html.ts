// Client-side textToHtml — mirrors send-message/route.ts textToHtml()
export function textToHtml(text: string): string {
  let h = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // CTA button: [■ text] URL
  h = h.replace(/\[\u25A0\s*(.+?)\]\s*(https?:\/\/\S+)/g, (_m: string, label: string, url: string) => {
    const bg = url.includes("line.me") ? "#06C755" : "#0891b2";
    return `<a href="${url}" style="display:inline-block;padding:12px 28px;background:${bg};color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;margin:4px 0;">${label}</a>`;
  });
  // Markdown text link: [text](url)
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_m: string, label: string, url: string) =>
    `<a href="${url}" style="color:#0891b2;text-decoration:underline;">${label}</a>`);
  // ▼ label + URL on next line
  h = h.replace(/\u25BC\s*(.+?)\n\s*(https?:\/\/\S+)/g, (_m: string, label: string, url: string) =>
    `<strong>${label}</strong><br><a href="${url}" style="color:#0891b2;">${url}</a>`);
  // Bare URLs (not already in <a>)
  h = h.replace(/(https?:\/\/\S+)/g, (url: string) => {
    if (url.includes('"') || url.includes('&lt;')) return url;
    return `<a href="${url}" style="color:#0891b2;">${url}</a>`;
  });
  h = h.replace(/\n/g, "<br>");
  return h;
}
