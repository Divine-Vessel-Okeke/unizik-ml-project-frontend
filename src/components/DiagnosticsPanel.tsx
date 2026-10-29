// src/components/DiagnosticsPanel.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sliders, X, RotateCcw, Activity, Lock } from "lucide-react";

export interface DiagnosticsValues {
  device_student_count_24h: number;
  page_dwell_time_seconds: number;
  is_high_risk_asn: number;
  failed_attempts_1h: number;
  session_hardware_mismatch: number;
  is_off_peak_hour: number;
}

type FeatureKey = keyof DiagnosticsValues;

const FEATURE_META: {
  key: FeatureKey;
  label: string;
  hint: string;
  type: 'int' | 'float' | 'binary';
  min: number;
  max: number;
  step: number;
}[] = [
  {
    key: 'device_student_count_24h',
    label: 'Students on this device (24h)',
    hint: 'Distinct accounts that used this fingerprint in the last 24h',
    type: 'int', min: 0, max: 150, step: 1,
  },
  {
    key: 'page_dwell_time_seconds',
    label: 'Page dwell time (seconds)',
    hint: 'Time on checkout page — ticks live until manually edited',
    type: 'float', min: 0.1, max: 180, step: 0.1,
  },
  {
    key: 'is_high_risk_asn',
    label: 'High-risk ASN (VPN / datacenter)',
    hint: '0 = major Nigerian mobile carrier, 1 = anything else',
    type: 'binary', min: 0, max: 1, step: 1,
  },
  {
    key: 'failed_attempts_1h',
    label: 'Failed attempts (past hour)',
    hint: 'Recent blocked attempts from this student or device',
    type: 'int', min: 0, max: 20, step: 1,
  },
  {
    key: 'session_hardware_mismatch',
    label: 'Session hardware mismatch',
    hint: '0 = current fingerprint matches login baseline, 1 = differs',
    type: 'binary', min: 0, max: 1, step: 1,
  },
  {
    key: 'is_off_peak_hour',
    label: 'Off-peak hour (1:00–4:30 AM WAT)',
    hint: '0 = normal hours, 1 = high-risk early-morning window',
    type: 'binary', min: 0, max: 1, step: 1,
  },
];

interface DiagnosticsPanelProps {
  studentId: string;
  deviceId: string;
  hardwareMismatch: number;
  startTime: number;
  onValuesChange: (
    finalValues: DiagnosticsValues,
    isSimulated: boolean,
    serverOverrides: Partial<DiagnosticsValues>
  ) => void;
}

export default function DiagnosticsPanel({
  studentId,
  deviceId,
  hardwareMismatch,
  startTime,
  onValuesChange,
}: DiagnosticsPanelProps) {
  const [open, setOpen] = useState(false);
  const [serverFeatures, setServerFeatures] = useState<Partial<DiagnosticsValues>>({});
  const [tickDwell, setTickDwell] = useState(0);
  const [editedKeys, setEditedKeys] = useState<Set<FeatureKey>>(new Set());
  const [editedValues, setEditedValues] = useState<Partial<DiagnosticsValues>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  // Poll server for DB-backed features (device count, failed attempts, ASN, off-peak)
  useEffect(() => {
    if (!studentId || !deviceId) return;
    const fetchFeatures = async () => {
      try {
        const res = await fetch(
          `/api/telemetry?studentId=${encodeURIComponent(studentId)}&deviceId=${encodeURIComponent(deviceId)}`
        );
        const data = await res.json();
        if (data.success) setServerFeatures(data.features);
      } catch {
        /* silent — panel keeps last known values */
      }
    };
    fetchFeatures();
    const interval = setInterval(fetchFeatures, 5000);
    return () => clearInterval(interval);
  }, [studentId, deviceId]);

  // Local 1s tick for page dwell time
  useEffect(() => {
    const interval = setInterval(() => {
      setTickDwell((performance.now() - startTime) / 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Compute live values (merged from server + client)
  const liveValues: DiagnosticsValues = {
    device_student_count_24h: serverFeatures.device_student_count_24h ?? 1,
    page_dwell_time_seconds: tickDwell,
    is_high_risk_asn: serverFeatures.is_high_risk_asn ?? 0,
    failed_attempts_1h: serverFeatures.failed_attempts_1h ?? 0,
    session_hardware_mismatch: hardwareMismatch,
    is_off_peak_hour: serverFeatures.is_off_peak_hour ?? 0,
  };

  // Final merged values — edited values win
  const finalValues: DiagnosticsValues = { ...liveValues };
  for (const key of editedKeys) {
    const v = editedValues[key];
    if (v !== undefined) finalValues[key] = v;
  }

  const isSimulated = editedKeys.size > 0;

  // Overrides that need to be sent to the backend (only server-computed features;
  // dwell time and hardware mismatch flow through regular payload fields).
  const serverOverrides: Partial<DiagnosticsValues> = {};
  const SERVER_KEYS: FeatureKey[] = [
    'device_student_count_24h',
    'is_high_risk_asn',
    'failed_attempts_1h',
    'is_off_peak_hour',
  ];
  for (const key of SERVER_KEYS) {
    if (editedKeys.has(key)) {
      serverOverrides[key] = finalValues[key];
    }
  }

  // Push final state to parent on every meaningful change
  useEffect(() => {
    onValuesChange(finalValues, isSimulated, serverOverrides);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    finalValues.device_student_count_24h,
    finalValues.page_dwell_time_seconds,
    finalValues.is_high_risk_asn,
    finalValues.failed_attempts_1h,
    finalValues.session_hardware_mismatch,
    finalValues.is_off_peak_hour,
    isSimulated,
  ]);

  const handleEdit = (key: FeatureKey, rawValue: string) => {
    const num = parseFloat(rawValue);
    if (Number.isNaN(num)) return;

    const meta = FEATURE_META.find((m) => m.key === key)!;
    const clamped = Math.min(meta.max, Math.max(meta.min, num));

    setEditedKeys((prev) => new Set([...prev, key]));
    setEditedValues((prev) => ({ ...prev, [key]: clamped }));
  };

  const handleReset = () => {
    setEditedKeys(new Set());
    setEditedValues({});
  };

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Only close if the click is not on the trigger button
        const trigger = document.getElementById('diagnostics-panel-trigger');
        if (trigger && trigger.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      {/* Trigger button — fixed middle-right */}
      <button
        id="diagnostics-panel-trigger"
        onClick={() => setOpen(!open)}
        title="Open diagnostic telemetry panel"
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 px-2 py-5 rounded-l-2xl shadow-lg transition-all cursor-pointer ${
          isSimulated
            ? 'bg-amber-500 hover:bg-amber-600'
            : 'bg-[#001C3D] hover:bg-[#00152e]'
        } text-white`}
      >
        <Sliders className="w-5 h-5" />
        {isSimulated && (
          <span className="absolute -top-1 -left-1 w-3 h-3 bg-amber-500 rounded-full animate-pulse border-2 border-white" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className={`fixed right-0 top-1/2 -translate-y-1/2 z-50 w-full max-w-md max-h-[90vh] overflow-y-auto bg-white border-l-2 shadow-2xl rounded-l-2xl transition-colors ${
            isSimulated ? 'border-amber-400' : 'border-slate-200'
          }`}
        >
          {/* Header */}
          <div className={`px-5 py-4 border-b flex items-center justify-between ${
            isSimulated ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <Activity className={`w-4 h-4 ${isSimulated ? 'text-amber-600' : 'text-[#001C3D]'}`} />
              <div>
                <h3 className={`text-sm font-extrabold uppercase tracking-wide ${
                  isSimulated ? 'text-amber-900' : 'text-[#001C3D]'
                }`}>
                  {isSimulated ? 'Simulation Active' : 'Live Telemetry Monitor'}
                </h3>
                <p className={`text-[10px] font-medium ${
                  isSimulated ? 'text-amber-700' : 'text-slate-500'
                }`}>
                  {isSimulated
                    ? 'Submitted record will be marked SIMULATED'
                    : 'All values observed live — refreshes every 5s'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-white/50 cursor-pointer"
              aria-label="Close panel"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* Feature rows */}
          <div className="divide-y divide-slate-100">
            {FEATURE_META.map((meta) => {
              const isEdited = editedKeys.has(meta.key);
              const liveValue = liveValues[meta.key];
              const finalValue = finalValues[meta.key];
              const displayLive = meta.type === 'float' ? liveValue.toFixed(2) : String(liveValue);

              return (
                <div key={meta.key} className={`px-5 py-3 ${isEdited ? 'bg-amber-50/40' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">{meta.label}</span>
                        {isEdited && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-amber-200 text-amber-900">
                            <Lock className="w-2 h-2" />
                            SIMULATED
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{meta.hint}</p>
                    </div>

                    <div className="text-right shrink-0">
                      {meta.type === 'binary' ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(meta.key, '0')}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                              finalValue === 0
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            0
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(meta.key, '1')}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                              finalValue === 1
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            1
                          </button>
                        </div>
                      ) : (
                        <input
                          type="number"
                          min={meta.min}
                          max={meta.max}
                          step={meta.step}
                          value={isEdited ? finalValue : ''}
                          placeholder={displayLive}
                          onChange={(e) => handleEdit(meta.key, e.target.value)}
                          className={`w-24 px-2 py-1 rounded text-[11px] font-mono font-bold text-right border focus:outline-none focus:ring-2 ${
                            isEdited
                              ? 'bg-white border-amber-300 text-amber-900 focus:ring-amber-200'
                              : 'bg-slate-50 border-slate-200 text-slate-700 focus:ring-[#001C3D]/20 focus:border-[#001C3D]'
                          }`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold">
              <span className={`w-2 h-2 rounded-full ${
                isSimulated ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'
              }`} />
              <span className={isSimulated ? 'text-amber-700' : 'text-emerald-700'}>
                {isSimulated ? `${editedKeys.size} override${editedKeys.size === 1 ? '' : 's'} active` : 'Live'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleReset}
              disabled={!isSimulated}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                isSimulated
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              Reset to Live
            </button>
          </div>
        </div>
      )}
    </>
  );
}