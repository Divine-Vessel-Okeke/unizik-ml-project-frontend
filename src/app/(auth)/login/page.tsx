// src/app/(auth)/login/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, ArrowRight, AlertCircle } from "lucide-react";
import { generateDeviceFingerprint } from "@/lib/fingerprint";
import { MSG } from "@/lib/messages";
import { isAdminRole } from "@/lib/roles";

export default function LoginPage() {
  const router = useRouter();
  const [matricNumber, setMatricNumber] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate device fingerprint on mount; sent to server with login request
  useEffect(() => {
    generateDeviceFingerprint()
      .then((fp) => setDeviceId(fp))
      .catch(() => {
        console.error("[LOGIN] An error occurred during fingerprint generation.");
        setDeviceId("UNIZIK_FP_UNAVAILABLE");
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isAdmin ? { username } : { matricNumber }),
          password,
          deviceId,
          isAdmin,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const serverRole = data.role;
        if (!serverRole) {
          setError(MSG.GENERIC_ERROR);
          return;
        }

        const userProfile = { ...data.user, role: serverRole };
        localStorage.setItem("unizik_user", JSON.stringify(userProfile));

        if (serverRole === "STUDENT") {
          router.push("/dashboard");
        } else if (isAdminRole(serverRole)) {
          router.push("/admin/dashboard");
        } else {
          setError(MSG.GENERIC_ERROR);
        }
      } else {
        setError(data.error || MSG.GENERIC_ERROR);
      }
    } catch (err) {
      setError(MSG.GENERIC_ERROR);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8 font-sans selection:bg-[#001C3D] selection:text-white">

      {/* Main Authentication Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md my-auto">
        {/* Brand & Logo Section */}
        <div className="text-center mb-6">
          <div className="flex justify-center items-center mb-3">
            <img
              src="/unizik.png"
              alt="UNIZIK Crest"
              className="h-16 object-contain"
            />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#001C3D]">
            NNAMDI AZIKIWE UNIVERSITY
          </h2>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#F58220] mt-1">
            Awka, Anambra State
          </p>
          <p className="text-sm text-slate-600 mt-2 font-medium">
            {isAdmin ? "Admin Login" : "Student Login"} {"(Prototype)"}
          </p>
        </div>

        {/* White Card Container */}
        <div className="bg-white border border-slate-200/80 py-8 px-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl sm:px-10 relative">
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
              Undergraduate
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
              Admin
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
                  placeholder={isAdmin ? "e.g. admin" : "e.g. 2022514001"}
                  value={isAdmin ? username : matricNumber}
                  onChange={(e) =>
                    isAdmin
                      ? setUsername(e.target.value)
                      : setMatricNumber(e.target.value)
                  }
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
              disabled={loading || !deviceId}
              className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.99] ${
                isAdmin
                  ? "bg-[#F58220] hover:bg-[#d97016] shadow-orange-500/20"
                  : "bg-[#001C3D] hover:bg-[#00152e] shadow-blue-950/20"
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Loading ...</span>
                </div>
              ) : (
                <>
                  <span>{isAdmin ? "Admin Login" : "Student Login"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

        {/* Undergraduate Registration Redirect */}
        {!isAdmin && (
          <p className="mt-6 text-center text-xs text-slate-600 font-medium animate-in fade-in duration-300">
            Don&apos;t have a student account yet?{" "}
            <a
              href="/register"
              className="text-[#001C3D] hover:text-[#F58220] font-bold hover:underline transition-colors cursor-pointer"
            >
              Register Here
            </a>
          </p>
        )}
      </div>

    </div>
  );
}