import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { FloatingHelp } from "@/components/floating-help";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "doc-maker · 三层 UI 原型",
  description: "L1 业务控制台 / L2 总览控制台 / L3 节点控制台",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans antialiased`}
      >
        {children}
        <FloatingHelp />
      </body>
    </html>
  );
}
