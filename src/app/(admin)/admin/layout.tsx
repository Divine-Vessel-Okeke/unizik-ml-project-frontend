// src/app/(admin)/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminRole, isStudentRole } from "@/lib/roles";
import { logout } from "@/lib/auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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

      if (isStudentRole(parsed.role)) {
        router.replace("/dashboard");
        return;
      }

      if (!isAdminRole(parsed.role)) {
        logout();
        router.replace("/login");
        return;
      }

      setAuthorized(true);
    } catch {
      logout();
      router.replace("/login");
    } finally {
      setChecking(false);
    }
  }, [router]);

  if (checking || !authorized) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-slate-600 font-sans">
        <div className="w-8 h-8 border-3 border-[#001C3D]/20 border-t-[#001C3D] rounded-full animate-spin mb-3" />
        <span className="text-sm font-semibold tracking-wide text-[#001C3D]">
          Checking sign-in state...
        </span>
      </div>
    );
  }

  return <>{children}</>;
}