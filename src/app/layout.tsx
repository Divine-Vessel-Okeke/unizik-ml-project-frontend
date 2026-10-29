// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import {project_summary} from "@/lib/config"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Design and Implementation of a Predictive Fraud Detection System for University E-payment Portals using Decision Tree Classification | OKEKE DIVINE-VESSEL",
  description: project_summary,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-unizik-bg text-slate-900">
        {children}
      </body>
    </html>
  );
}