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
      className="inline-flex items-center gap-2 text-sm font-bold text-[#001C3D] hover:text-[#F58220] transition-colors duration-150 cursor-pointer group"
      title="Return to Previous Page"
    >
      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
      <span>Return to Previous Page</span>
    </button>
  );
}