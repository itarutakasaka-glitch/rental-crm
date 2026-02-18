import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "不動産CRM", description: "賃貸仲介管理システム" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
