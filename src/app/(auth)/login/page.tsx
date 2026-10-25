// unizik-ml-fraud-frontend/src/app/(auth)/login/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, User, ArrowRight, AlertCircle, Cpu } from "lucide-react";
import { generateDeviceFingerprint } from "@/lib/fingerprint";

export default function LoginPage() {
  const router = useRouter();
  const [matricNumber, setMatricNumber] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [deviceId, setDeviceId] = useState("HARVESTING_FINGERPRINT...");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Harvest hardware fingerprint silently on mount
  useEffect(() => {
    generateDeviceFingerprint().then((fp) => setDeviceId(fp));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricNumber, password, deviceId, isAdmin }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // RUTHLESS FIX: Explicitly embed the role into the localStorage object
        // so it can never be undefined on subsequent pages.
        const userProfile = {
          ...data.user,
          role:
            data.role ||
            data.user?.role ||
            (isAdmin ? "BURSARY_DIRECTOR" : "STUDENT"),
        };
        localStorage.setItem("unizik_user", JSON.stringify(userProfile));

        // Redirect to appropriate domain
        if (
          userProfile.role === "ADMIN" ||
          userProfile.role === "BURSARY_DIRECTOR"
        ) {
          router.push("/admin/dashboard");
        } else {
          router.push("/dashboard");
        }
      } else {
        setError(data.error || "Login attempt failed.");
      }
    } catch (err) {
      setError("Unable to connect to authentication server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 font-sans selection:bg-[#001C3D] selection:text-white">
      {/* Academic Research Header Banner */}
      <div className="max-w-4xl mx-auto w-full text-center border-b border-slate-200/80 pb-6 mb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-[#001C3D] text-xs font-semibold uppercase tracking-wider mb-3">
          <Shield className="w-3.5 h-3.5 text-[#F58220]" />
          <span>B.Sc. Computer Science Capstone Project</span>
        </div>
        <h1 className="text-xs sm:text-sm font-mono text-slate-500 max-w-2xl mx-auto leading-relaxed">
          &ldquo;Development of a Predictive Fraud Detection System for
          University E-payment Portals using Decision Tree
          Classification&rdquo;
        </h1>
      </div>

      {/* Main Authentication Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md my-auto">
        {/* Brand & Logo Section */}
        <div className="text-center mb-6">
          <div className="flex justify-center items-center mb-3">
            <img
              src="/unizik.png"
              alt="Nnamdi Azikiwe University Crest"
              className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-sm"
            />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#001C3D]">
            NNAMDI AZIKIWE UNIVERSITY
          </h2>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#F58220] mt-1">
            Awka, Anambra State
          </p>
          <p className="text-sm text-slate-600 mt-2 font-medium">
            {isAdmin
              ? "Bursary & ICT Administrative Command"
              : "Student Fee Payment & Financial Portal"}
          </p>
        </div>

        {/* Vercel-Style Glass Card Container */}
        <div className="bg-white border border-slate-200/80 py-8 px-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl sm:px-10 relative">
          {/* Vercel/Stripe Mode Pill Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 mb-6">
            <button
              type="button"
              onClick={() => {
                setIsAdmin(false);
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                !isAdmin
                  ? "bg-[#001C3D] text-white shadow-md shadow-blue-950/20"
                  : "text-slate-600 hover:text-[#001C3D] hover:bg-slate-200/50"
              }`}
            >
              Undergraduate Portal
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdmin(true);
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                isAdmin
                  ? "bg-[#F58220] text-white shadow-md shadow-orange-600/20"
                  : "text-slate-600 hover:text-[#001C3D] hover:bg-slate-200/50"
              }`}
            >
              Admin Command
            </button>
          </div>

          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                {isAdmin ? "Admin Username" : "Matriculation Number"}
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder={isAdmin ? "e.g. admin" : "e.g. 2022/184042"}
                  value={matricNumber}
                  onChange={(e) => setMatricNumber(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#001C3D] focus:ring-2 focus:ring-[#001C3D]/10 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#001C3D] focus:ring-2 focus:ring-[#001C3D]/10 transition-all font-medium"
                />
              </div>
            </div>

            {/* Error Notification Badge */}
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed">{error}</span>
              </div>
            )}

            {/* Action Button anchored to UNIZIK Brand Palette */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.99] ${
                isAdmin
                  ? "bg-[#F58220] hover:bg-[#d97016] shadow-orange-500/20"
                  : "bg-[#001C3D] hover:bg-[#00152e] shadow-blue-950/20"
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Hardware &amp; Credentials...</span>
                </div>
              ) : (
                <>
                  <span>
                    {isAdmin
                      ? "Authorize Admin Access"
                      : "Secure Student Login"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Live Security Telemetry Sensor Card */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-[#001C3D]" />
                  Active Telemetry Sensor
                </span>
              </div>
              <span className="text-[11px] font-mono font-semibold text-slate-700 truncate max-w-[160px] bg-white px-2 py-0.5 rounded border border-slate-200">
                {deviceId}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2 font-mono">
              SHA-256 browser attributes harvested for real-time decision tree
              validation.
            </p>
          </div>
        </div>

        {/* Undergraduate Registration Redirect */}
        {!isAdmin && (
          <p className="mt-6 text-center text-xs text-slate-600 font-medium animate-in fade-in duration-300">
            Don&apos;t have a student profile yet?{" "}
            <a
              href="/register"
              className="text-[#001C3D] hover:text-[#F58220] font-bold hover:underline transition-colors cursor-pointer"
            >
              Register New Undergraduate Profile
            </a>
          </p>
        )}
      </div>

      {/* Institutional Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center mt-auto pt-6 text-[11px] text-slate-400 font-medium">
        <p>
          &copy; {new Date().getFullYear()} Nnamdi Azikiwe University, Awka.
          All rights reserved.
        </p>
        <p className="mt-0.5 text-slate-400/80 font-mono">
          Secured by Real-Time Machine Learning Behavioral Analysis &amp;
          SQLite Transaction Audit Engine.
        </p>
      </footer>
    </div>
  );
}