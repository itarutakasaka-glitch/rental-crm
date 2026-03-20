// Client-side textToHtml — mirrors send-message/route.ts textToHtml()
// Line-by-line processing: standalone [■ text] URL = CTA button, inline = text link
export function textToHtml(text: string): string {
  const lines = text.split("\n");
  const resultLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    line = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Standalone [■ text] URL → CTA button
    const standaloneMatch = line.match(/^\[■\s*(.+?)\]\s*(https?:\/\/\S+)$/);
    if (standaloneMatch) {
      const label = standaloneMatch[1];
      const url = standaloneMatch[2];
      const bg = url.includes("line.me") ? "#06C755" : "#0891b2";
      resultLines.push(`<a href="${url}" style="display:inline-block;padding:12px 28px;background:${bg};color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;margin:4px 0;">${label}</a>`);
      continue;
    }

    // Inline [■ text] URL → text link
    line = line.replace(/\[■\s*(.+?)\]\s*(https?:\/\/\S+)/g, (_m: string, label: string, url: string) =>
      `<a href="${url}" style="color:#0891b2;text-decoration:underline;">${label}</a>`);

    // Markdown text links: [text](url)
    line = line.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_m: string, label: string, url: string) =>
      `<a href="${url}" style="color:#0891b2;text-decoration:underline;">${label}</a>`);

    // ▼ label + URL on next line
    if (line.match(/\u25BC\s*.+/) && i + 1 < lines.length) {
      const nextLine = lines[i + 1]?.trim();
      if (nextLine && /^https?:\/\//.test(nextLine)) {
        const label = line.replace(/^\u25BC\s*/, "");
        const escapedNext = nextLine.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        resultLines.push(`<strong>${label}</strong><br><a href="${escapedNext}" style="color:#0891b2;">${escapedNext}</a>`);
        i++;
        continue;
      }
    }

    // Bare URLs (not already in <a>)
    line = line.replace(/(https?:\/\/\S+)/g, (url: string) => {
      if (url.includes('"') || url.includes("&lt;")) return url;
      return `<a href="${url}" style="color:#0891b2;">${url}</a>`;
    });

    resultLines.push(line);
  }

  return resultLines.join("<br>");
}
