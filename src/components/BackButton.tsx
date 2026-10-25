// src/components/BackButton.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 hover:text-white hover:bg-[#001C3D] rounded-xl transition-all duration-150 border border-slate-200 hover:border-[#001C3D] shadow-2xs cursor-pointer"
      title="Go Back"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span>Back</span>
    </button>
  );
}