// src/app/(student)/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("unizik_user");
    if (!storedUser) {
      router.replace("/login");
      return;
    }

    try {
      const parsed = JSON.parse(storedUser);
      const isAdmin = parsed.role === "ADMIN" || parsed.role === "BURSARY_DIRECTOR";

      // Receipt is the ONLY student route admins may access —
      // they inspect cleared payments from the admin side via "View Receipt" buttons.
      const isReceiptRoute = pathname?.startsWith("/receipt/") || pathname === "/receipt";

      if (isAdmin && !isReceiptRoute) {
        router.replace("/admin/dashboard");
        return;
      }

      setAuthorized(true);
    } catch {
      router.replace("/login");
    } finally {
      setChecking(false);
    }
  }, [pathname, router]);

  if (checking || !authorized) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-slate-600 font-sans">
        <div className="w-8 h-8 border-3 border-[#001C3D]/20 border-t-[#001C3D] rounded-full animate-spin mb-3" />
        <span className="text-sm font-semibold tracking-wide text-[#001C3D]">
          Verifying session...
        </span>
      </div>
    );
  }

  return <>{children}</>;
}