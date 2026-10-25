// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "UNIZIK E-Payment Fraud Detection System",
  description:
    "Predictive fraud detection for university e-payment portals using Decision Tree Classification — Nnamdi Azikiwe University, Awka",
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