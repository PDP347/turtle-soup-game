import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "海龟汤 · 悬疑推理",
  description: "由 AI 主持的海龟汤情景推理游戏，从离奇谜面推理出隐藏真相",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="app-layout">{children}</body>
    </html>
  );
}
