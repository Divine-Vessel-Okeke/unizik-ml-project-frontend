// src/app/(admin)/admin/dashboard/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  AlertTriangle,
  FileText,
  Activity,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import AdminHeader from "@/components/AdminHeader";

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("unizik_user");
    if (!storedUser) {
      router.push("/login");
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== "ADMIN" && parsedUser.role !== "BURSARY_DIRECTOR") {
      router.push("/dashboard");
      return;
    }

    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then((res) => setData(res.stats))
      .catch((err) => console.error("Failed to fetch admin stats", err));
  }, [router]);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-slate-600 font-sans">
        <div className="w-8 h-8 border-3 border-[#001C3D]/20 border-t-[#001C3D] rounded-full animate-spin mb-3" />
        <span className="text-sm font-semibold tracking-wide text-[#001C3D]">
          Loading Bursary Overview...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans pb-16 selection:bg-[#001C3D] selection:text-white">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Top-Level Financial & Security Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: Cleared Revenue */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Cleared Revenue
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#001C3D] font-mono tracking-tight mt-1">
              ₦
              {data.totalRevenue?.toLocaleString("en-NG", {
                minimumFractionDigits: 2,
              }) || "0.00"}
            </div>
            <span className="text-[11px] text-slate-500 font-medium mt-3 border-t border-slate-100 pt-2.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Verified university fee deposits</span>
            </span>
          </div>

          {/* Card 2: Security Holds */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Security Holds / Blocked
              </span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 font-mono tracking-tight mt-1">
              {data.fraudCount || 0}
            </div>
            <span className="text-[11px] text-slate-500 font-medium mt-3 border-t border-slate-100 pt-2.5 flex items-center justify-between">
              <span>Suspicious attempts intercepted</span>
              <button
                onClick={() => router.push("/admin/appeals")}
                className="text-[#001C3D] font-bold hover:underline cursor-pointer"
              >
                Review Appeals &rarr;
              </button>
            </span>
          </div>

          {/* Card 3: System Health */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Security System Status
              </span>
              <div className="p-2 bg-blue-50 text-[#001C3D] rounded-lg">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="text-lg font-extrabold text-emerald-600 mt-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Active & Online</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium mt-3 border-t border-slate-100 pt-2.5">
              Automated checks running on all portals
            </span>
          </div>
        </div>

        {/* Recent Payment Activity Table */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-[#001C3D] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#F58220]" />
                <span>Recent Payment Activity</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Real-time log of student fee payments and automated security
                checks.
              </p>
            </div>

            <button
              onClick={() => router.push("/admin/transactions")}
              className="px-4 py-2 bg-white border border-slate-200 hover:border-[#001C3D] hover:text-[#001C3D] text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>View All Transactions</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#F58220]" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Date & Time</th>
                  <th className="py-3.5 px-6">Matriculation No.</th>
                  <th className="py-3.5 px-6">Amount (₦)</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">System Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {data.transactions?.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-12 text-center text-slate-400 font-medium"
                    >
                      No transaction records found for this academic session.
                    </td>
                  </tr>
                ) : (
                  data.transactions?.map((tx: any) => {
                    const isBlocked =
                      tx.status === "BLOCKED" || tx.status === "DECLINED";
                    return (
                      <tr
                        key={tx.id}
                        onClick={() =>
                          router.push(`/admin/forensics/${tx.id}`)
                        }
                        className="hover:bg-blue-50/40 transition-colors duration-150 cursor-pointer group"
                        title="Click row to view full transaction details"
                      >
                        <td className="py-4 px-6 text-slate-500 font-mono group-hover:text-[#001C3D] transition-colors">
                          {new Date(tx.createdAt).toLocaleString("en-NG", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-4 px-6 font-extrabold text-[#001C3D]">
                          {tx.student?.matricNumber || "N/A"}
                        </td>
                        <td className="py-4 px-6 font-extrabold text-slate-900 font-mono">
                          ₦
                          {tx.amount.toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full font-sans text-[10px] font-extrabold uppercase tracking-wider border ${
                              isBlocked
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-500 max-w-[280px] truncate group-hover:text-slate-800 transition-colors font-sans">
                          <span className="flex items-center justify-between">
                            <span className="truncate">
                              {tx.auditLog?.explanation ||
                                "Payment cleared successfully."}
                            </span>
                            <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 text-[#F58220] transition-opacity shrink-0 ml-2" />
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}