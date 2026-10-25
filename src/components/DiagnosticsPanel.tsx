// src/components/DiagnosticsPanel.tsx
"use client";

import React from "react";
import { Cpu, Wifi, Clock, Fingerprint } from "lucide-react";

interface DiagnosticsPanelProps {
  deviceId?: string;
  ipAddress?: string;
  pageDwellTime?: number;
  className?: string;
}

export default function DiagnosticsPanel({
  deviceId,
  ipAddress,
  pageDwellTime,
  className = "",
}: DiagnosticsPanelProps) {
  return (
    <div
      className={`bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 ${className}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Cpu className="w-4 h-4 text-[#001C3D]" />
        <span className="text-xs font-bold text-[#001C3D] uppercase tracking-wide">
          Live Telemetry Capture
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Fingerprint className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="font-mono truncate">{deviceId || "harvesting..."}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <Wifi className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="font-mono">{ipAddress || "pending"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="font-mono">
            {typeof pageDwellTime === "number"
              ? `${pageDwellTime.toFixed(1)}s dwell`
              : "tracking..."}
          </span>
        </div>
      </div>
    </div>
  );
}