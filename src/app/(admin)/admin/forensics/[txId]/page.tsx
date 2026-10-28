// src/app/admin/forensics/[txId]/page.tsx
"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert, CheckCircle2, AlertTriangle, Terminal, Cpu, Clock, Lock, AlertOctagon,
} from "lucide-react";
import AdminHeader from "@/components/AdminHeader";
import BackButton from "@/components/BackButton";

// WAT off-peak window: 1:00 AM – 4:30 AM
function computeOffPeakFromTimestamp(isoString: string): number {
  const d = new Date(isoString);
  const utcH = d.getUTCHours();
  const utcM = d.getUTCMinutes();
  let watH = utcH + 1;
  if (watH >= 24) watH -= 24;
  if (watH >= 1 && watH < 4) return 1;
  if (watH === 4 && utcM <= 30) return 1;
  return 0;
}

export default function WhiteBoxForensicsPage({ params }: { params: Promise<{ txId: string }> }) {
  const router = useRouter();
  const { txId } = use(params);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("unizik_user");
    if (!storedUser) { router.push("/login"); return; }
    const parsedUser = JSON.parse(storedUser);
    const userRole = parsedUser.role || (parsedUser.username ? "BURSARY_DIRECTOR" : "STUDENT");
    if (userRole !== "ADMIN" && userRole !== "BURSARY_DIRECTOR") {
      router.push("/dashboard");
      return;
    }

    fetch(`/api/admin/forensics/${txId}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success) setData(resData.transaction);
        else setError(resData.error || "Unable to retrieve forensic audit log.");
      })
      .catch(() => setError("Network error communicating with XAI audit engine."))
      .finally(() => setLoading(false));
  }, [txId, router]);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-slate-600 font-sans">
        <div className="w-8 h-8 border-3 border-[#001C3D]/20 border-t-[#001C3D] rounded-full animate-spin mb-3" />
        <span className="text-sm font-semibold tracking-wide text-[#001C3D]">
          Extracting White-Box AI Telemetry...
        </span>
      </div>
    );
  }

  const isBlocked = data.status === "BLOCKED" || data.status === "DECLINED" || data.auditLog?.verdict === "FRAUDULENT";
  const confidencePercent = data.auditLog?.confidence ? (data.auditLog.confidence * 100).toFixed(1) : "N/A";

  // Telemetry source
  const telemetrySource: 'LIVE' | 'SIMULATED' | 'UNSPECIFIED' = data.telemetrySource || 'UNSPECIFIED';

  // Discrepancy detection
  const actualHardwareMismatch =
    (data.student?.loginDeviceId && data.deviceId && data.student.loginDeviceId !== data.deviceId) ? 1 : 0;

  const discrepancies: { severity: 'error' | 'warning' | 'info'; message: string }[] = [];

  const computedOffPeak = computeOffPeakFromTimestamp(data.createdAt);
  if (data.isOffPeak === 1 && computedOffPeak === 0) {
    discrepancies.push({
      severity: telemetrySource === 'SIMULATED' ? 'info' : 'error',
      message:
        `Off-peak flag is 1, but timestamp ${new Date(data.createdAt).toLocaleString("en-NG")} is NOT in the 1:00–4:30 AM WAT window. ` +
        (telemetrySource === 'SIMULATED'
          ? 'Expected value was manually overridden in the diagnostics panel.'
          : 'Data integrity issue, flag does not match timestamp.'),
    });
  }
  if (data.isOffPeak === 0 && computedOffPeak === 1) {
    discrepancies.push({
      severity: 'error',
      message: `Off-peak flag is 0, but timestamp IS in the 1:00–4:30 AM WAT window. Data integrity issue.`,
    });
  }

  if (data.hardwareMismatch === 0 && actualHardwareMismatch === 1) {
    discrepancies.push({
      severity: telemetrySource === 'SIMULATED' ? 'info' : 'error',
      message:
        `Stored hardware_mismatch is 0 (verified), but fingerprints genuinely differ: baseline ` +
        `${(data.student?.loginDeviceId || '').substring(0, 25)}… vs current ${(data.deviceId || '').substring(0, 25)}… ` +
        (telemetrySource === 'SIMULATED'
          ? 'Expected device fingerprint was overridden for demonstration.'
          : 'Data integrity issue, flag does not match reality.'),
    });
  }
  if (data.hardwareMismatch === 1 && actualHardwareMismatch === 0) {
    discrepancies.push({
      severity: 'warning',
      message: `Stored hardware_mismatch is 1, but fingerprints match.`,
    });
  }

  if ((data.deviceId || '').includes('MALICIOUS_BOT') || (data.deviceId || '').includes('PROXY_CLUSTER')) {
    discrepancies.push({
      severity: 'warning',
      message:
        `Device ID contains a demonstration marker ("${data.deviceId}"). Legacy test record — created before telemetry_source tracking existed. Stored feature values were preset by the old simulation code, not observed from a real browser.`,
    });
  }

  if (data.auditLog?.confidence === 0.9999) {
    discrepancies.push({
      severity: 'warning',
      message:
        `Confidence is exactly 0.9999 — the hardcoded value used by the fallback heuristic when the Python ML service was unreachable. Verdict was produced by the fallback rule, not the trained Decision Tree.`,
    });
  }

  if (data.status === 'BLOCKED' && !data.auditLog) {
    discrepancies.push({
      severity: 'error',
      message: `Transaction is BLOCKED but has no FraudAuditLog record. Suggests a partial DB write.`,
    });
  }

  // Telemetry source pill (small, under status)
  const sourcePill =
    telemetrySource === 'SIMULATED'
      ? { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', label: 'SIMULATED', icon: '⚠' }
      : telemetrySource === 'LIVE'
      ? { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-700', label: 'LIVE', icon: '●' }
      : { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-500', label: 'UNSPECIFIED', icon: '·' };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans pb-16 selection:bg-[#001C3D] selection:text-white">
      <AdminHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <BackButton />

        {/* Header Summary Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-2xs mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#F58220] bg-orange-50 px-2.5 py-1 rounded-md border border-orange-200">
                White-Box XAI Forensics
              </span>
              <span className="text-xs font-mono font-bold text-slate-400">
                REF: {data.reference}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#001C3D]">
              {data.student?.lastName} {data.student?.firstName} ({data.student?.matricNumber})
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {data.student?.department} • Level {data.student?.level} • Fee: {data.invoice?.category?.replace("_", " ")}
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Status</span>
            <div className="flex items-center gap-2">
              {isBlocked ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-extrabold uppercase tracking-wider shadow-2xs">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Intercepted (BLOCKED)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-extrabold uppercase tracking-wider shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Cleared (SUCCESS)</span>
                </span>
              )}
            </div>
            {/* Telemetry source pill — small, under status */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${sourcePill.bg} ${sourcePill.border} ${sourcePill.text}`}>
              <span className="font-mono">{sourcePill.icon}</span>
              <span className="uppercase tracking-wider">Source: {sourcePill.label}</span>
            </span>
          </div>
        </div>

        {/* Sequential AI Evaluation Pipeline */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#001C3D] mb-6 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#F58220]" />
            <span>Sequential AI Evaluation Pipeline</span>
          </h3>

          <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-0">
            <div className="hidden md:block absolute top-5 left-8 right-8 h-0.5 bg-slate-100 -z-0" />

            <div className="relative z-10 flex md:flex-col items-center gap-3.5 md:text-center w-full md:w-1/4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 font-bold text-xs ${
                data.hardwareMismatch === 1
                  ? "bg-rose-50 border-rose-500 text-rose-600 shadow-sm shadow-rose-500/10"
                  : "bg-emerald-50 border-emerald-500 text-emerald-600"
              }`}>
                {data.hardwareMismatch === 1 ? "✕" : "✓"}
              </div>
              <div>
                <span className="text-[11px] font-extrabold block text-[#001C3D]">1. Hardware Identity</span>
                <span className={`text-[10px] font-semibold block mt-0.5 ${data.hardwareMismatch === 1 ? "text-rose-600" : "text-slate-500"}`}>
                  {data.hardwareMismatch === 1 ? "Fingerprint Mismatch" : "Baseline Verified"}
                </span>
              </div>
            </div>

            <div className="relative z-10 flex md:flex-col items-center gap-3.5 md:text-center w-full md:w-1/4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 font-bold text-xs ${
                data.asnNumber === 1
                  ? "bg-rose-50 border-rose-500 text-rose-600 shadow-sm shadow-rose-500/10"
                  : "bg-emerald-50 border-emerald-500 text-emerald-600"
              }`}>
                {data.asnNumber === 1 ? "✕" : "✓"}
              </div>
              <div>
                <span className="text-[11px] font-extrabold block text-[#001C3D]">2. Network Origin</span>
                <span className={`text-[10px] font-semibold block mt-0.5 ${data.asnNumber === 1 ? "text-rose-600" : "text-slate-500"}`}>
                  {data.asnNumber === 1 ? "Foreign ASN / VPN" : "Local Nigerian Telco"}
                </span>
              </div>
            </div>

            <div className="relative z-10 flex md:flex-col items-center gap-3.5 md:text-center w-full md:w-1/4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 font-bold text-xs ${
                data.pageDwellTime < 2.0
                  ? "bg-rose-50 border-rose-500 text-rose-600 shadow-sm shadow-rose-500/10"
                  : "bg-emerald-50 border-emerald-500 text-emerald-600"
              }`}>
                {data.pageDwellTime < 2.0 ? "✕" : "✓"}
              </div>
              <div>
                <span className="text-[11px] font-extrabold block text-[#001C3D]">3. Behavioral Biometrics</span>
                <span className={`text-[10px] font-semibold block mt-0.5 ${data.pageDwellTime < 2.0 ? "text-rose-600" : "text-slate-500"}`}>
                  {data.pageDwellTime < 2.0 ? `Bot Speed (${data.pageDwellTime?.toFixed(1)}s)` : `Human Pace (${data.pageDwellTime?.toFixed(1)}s)`}
                </span>
              </div>
            </div>

            <div className="relative z-10 flex md:flex-col items-center gap-3.5 md:text-center w-full md:w-1/4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 font-bold text-xs ${
                isBlocked
                  ? "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/20"
                  : "bg-[#001C3D] border-[#001C3D] text-white shadow-md shadow-blue-900/20"
              }`}>
                {isBlocked ? "!" : "✓"}
              </div>
              <div>
                <span className="text-[11px] font-extrabold block text-[#001C3D]">4. AI Enforcement</span>
                <span className={`text-[10px] font-extrabold uppercase tracking-wider block mt-0.5 ${isBlocked ? "text-rose-600" : "text-emerald-600"}`}>
                  {isBlocked ? "Transaction Blocked" : "Payment Cleared"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Algorithmic Verdict */}
        <div className={`border rounded-2xl p-6 mb-6 shadow-2xs ${
          isBlocked ? "bg-rose-950 text-rose-100 border-rose-800" : "bg-[#001C3D] text-white border-slate-800"
        }`}>
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-[#F58220]" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Algorithmic Verdict &amp; White-Box Explanation
              </span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-lg border border-white/10 text-xs font-mono">
              <span className="text-slate-400">AI Confidence:</span>
              <span className="font-extrabold text-[#F58220]">{confidencePercent}%</span>
            </div>
          </div>
          <p className="font-mono text-sm sm:text-base leading-relaxed bg-black/30 p-4 rounded-xl border border-white/5">
            {data.auditLog?.explanation || "No anomaly detected. Standard payment authorization executed via university gateway."}
          </p>
        </div>

        {/* Telemetry Grids */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#001C3D] flex items-center gap-2 border-b border-slate-100 pb-3">
              <Cpu className="w-4 h-4 text-[#F58220]" />
              <span>Hardware &amp; Network Telemetry</span>
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">IP Address Origin</span>
                <span className="font-mono font-bold text-slate-800">{data.ipAddress || "127.0.0.1"}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Telco / ASN Risk Flag</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                  data.asnNumber === 1 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {data.asnNumber === 1 ? "HIGH RISK (VPN / FOREIGN ASN)" : "SAFE (LOCAL NIGERIAN TELCO)"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Hardware Variance Flag</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                  data.hardwareMismatch === 1 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {data.hardwareMismatch === 1 ? "MISMATCH DETECTED" : "VERIFIED HARDWARE"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#001C3D] flex items-center gap-2 border-b border-slate-100 pb-3">
              <Clock className="w-4 h-4 text-[#F58220]" />
              <span>Behavioral &amp; Temporal Metrics</span>
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Page Dwell Time</span>
                <span className={`font-mono font-bold ${data.pageDwellTime < 2.0 ? "text-rose-600" : "text-slate-800"}`}>
                  {data.pageDwellTime ? `${data.pageDwellTime.toFixed(2)}s` : "N/A"}
                  {data.pageDwellTime < 2.0 && " (BOT-LIKE SPEED)"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Execution Timestamp</span>
                <span className="font-mono text-slate-700">{new Date(data.createdAt).toLocaleString("en-NG")}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Off-Peak Hour Attempt</span>
                <span className="font-mono font-semibold text-slate-700">
                  {data.isOffPeak === 1 ? "YES (1:00–4:30 AM WAT)" : "NO (STANDARD HOURS)"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Fingerprint Comparison */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4 mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#001C3D] flex items-center gap-2 border-b border-slate-100 pb-3">
            <Lock className="w-4 h-4 text-[#F58220]" />
            <span>Cryptographic Device Fingerprint Ledger</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block mb-1">
                Baseline Fingerprint (At Student Login)
              </span>
              <span className="text-slate-700 break-all font-semibold">
                {data.student?.loginDeviceId || "NO BASELINE RECORDED"}
              </span>
            </div>
            <div className={`p-3.5 border rounded-xl ${
              data.hardwareMismatch === 1
                ? "bg-rose-50/50 border-rose-200 text-rose-900"
                : "bg-emerald-50/50 border-emerald-200 text-emerald-900"
            }`}>
              <span className="text-[10px] font-sans font-bold uppercase block mb-1">
                Transaction Fingerprint (At Payment Attempt)
              </span>
              <span className="break-all font-bold">
                {data.deviceId || "UNKNOWN DEVICE"}
              </span>
            </div>
          </div>
        </div>

        {/* Discrepancies — moved to bottom */}
        {discrepancies.length > 0 && (
          <div className="border-2 border-amber-300 bg-amber-50/60 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertOctagon className="w-5 h-5 text-amber-700" />
              <span className="text-sm font-extrabold uppercase tracking-wider text-amber-900">
                Discrepancies Detected ({discrepancies.length})
              </span>
            </div>
            <ul className="space-y-3">
              {discrepancies.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-amber-950">
                  <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                    d.severity === 'error' ? 'bg-rose-600 text-white'
                    : d.severity === 'warning' ? 'bg-amber-500 text-white'
                    : 'bg-slate-500 text-white'
                  }`}>
                    {d.severity}
                  </span>
                  <span>{d.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </main>
    </div>
  );
}