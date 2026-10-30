// src/app/(admin)/admin/velocity/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Laptop, Users, CheckCircle2, AlertTriangle, RefreshCw, Search, ChevronDown, ChevronUp, Building } from "lucide-react";
import AdminHeader from "@/components/AdminHeader";
import BackButton from "@/components/BackButton";
import { isAdminRole } from "@/lib/roles";

export default function DeviceActivityPage() {
  const router = useRouter();
  const [computers, setComputers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchComputers = () => {
    setLoading(true);
    fetch("/api/admin/velocity")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setComputers(data.computers);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("unizik_user");
    if (!storedUser) {
      router.push("/login");
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    if (!isAdminRole(parsedUser.role)) {
      router.push("/dashboard");
      return;
    }
    fetchComputers();
  }, [router]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter by fingerprint, name, or matric number
  const filteredComputers = computers.filter((pc) => {
    const query = searchQuery.toLowerCase();
    const matchesId = pc.deviceId.toLowerCase().includes(query);
    const matchesStudent = pc.studentsList?.some((s: any) =>
      s.matricNumber.toLowerCase().includes(query) ||
      s.name.toLowerCase().includes(query)
    );
    return matchesId || matchesStudent;
  });

  // Summary counts for the current data
  const totalSuspicious = computers.filter((c) => c.isSuspicious).length;
  const totalTenPlus = computers.filter((c) => c.studentCount >= 10).length;
  const totalThreeToNine = computers.filter((c) => c.studentCount >= 3 && c.studentCount < 10).length;
  const totalOneOrTwo = computers.filter((c) => c.studentCount < 3).length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans pb-16 selection:bg-[#001C3D] selection:text-white">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <BackButton />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#001C3D] tracking-tight flex items-center gap-2">
              <Laptop className="w-6 h-6 text-[#F58220]" />
              <span>{"Device Activity"}</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Devices grouped by browser fingerprint, with student and payment counts.
            </p>
          </div>
          <button
            onClick={fetchComputers}
            disabled={loading}
            className="self-start md:self-auto px-4 py-2.5 bg-white border border-slate-200/80 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#F58220] ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Guidance on high student counts */}
        <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4 mb-8 text-xs text-blue-950 flex items-start gap-3 shadow-2xs">
          <Building className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block text-blue-900">Admin Guide: Understanding High Student Counts</span>
            <p className="leading-relaxed text-slate-600">
              Commercial cybercafes naturally process payments for many students daily. A high student count is not by itself a sign of fraud. Only investigate devices where blocked attempts exceed cleared attempts.
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className={`border p-5 rounded-xl shadow-2xs ${
            totalSuspicious > 0
              ? "bg-rose-50 border-rose-200/80"
              : "bg-white border-slate-200/80"
          }`}>
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${
              totalSuspicious > 0 ? "text-rose-700" : "text-slate-400"
            }`}>
              Devices with More Blocks Than Clears
            </span>
            <div className={`text-2xl font-extrabold mt-1 ${
              totalSuspicious > 0 ? "text-rose-600" : "text-[#001C3D]"
            }`}>
              {totalSuspicious}
            </div>
          </div>
          <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">10+ Student Devices</span>
            <div className="text-2xl font-extrabold text-[#001C3D] mt-1">{totalTenPlus}</div>
          </div>
          <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">3–9 Student Devices</span>
            <div className="text-2xl font-extrabold text-[#001C3D] mt-1">{totalThreeToNine}</div>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">1–2 Student Devices</span>
            <div className="text-2xl font-extrabold text-[#001C3D] mt-1">{totalOneOrTwo}</div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs mb-6">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by device fingerprint, student name, or matric number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#001C3D] focus:ring-2 focus:ring-[#001C3D]/10 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Devices table */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-slate-400 font-medium flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-[#001C3D]/20 border-t-[#001C3D] rounded-full animate-spin" />
              <span className="text-xs font-semibold">Loading devices...</span>
            </div>
          ) : filteredComputers.length === 0 ? (
            <div className="p-16 text-center text-slate-400 font-medium space-y-1">
              <div className="text-sm font-bold text-slate-600">No devices found</div>
              <p className="text-xs">Try a different search query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/80 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-6">Device Fingerprint</th>
                    <th className="py-3.5 px-6">Students</th>
                    <th className="py-3.5 px-6">Classification</th>
                    <th className="py-3.5 px-6">Payment Activity</th>
                    <th className="py-3.5 px-6 text-right">Student List</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredComputers.map((pc) => {
                    const isExpanded = expandedId === pc.deviceId;

                    const isTenPlusStudents = pc.studentCount >= 10;
                    const isThreeToNineStudents = pc.studentCount >= 3 && pc.studentCount < 10;

                    return (
                      <React.Fragment key={pc.deviceId}>
                        <tr className={`hover:bg-blue-50/30 transition-colors ${isExpanded ? "bg-blue-50/20" : ""} ${pc.isSuspicious ? "bg-rose-50/30" : ""}`}>

                          {/* Col 1: Device fingerprint */}
                          <td className="py-4 px-6 font-mono text-xs font-bold text-[#001C3D]">
                            <div className="flex items-center gap-2">
                              <Laptop className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[220px]" title={pc.deviceId}>{pc.deviceId}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-sans font-normal ml-6 block">
                              Last transaction: {new Date(pc.lastActive).toLocaleDateString()}
                            </span>
                          </td>

                          {/* Col 2: Student count */}
                          <td className="py-4 px-6 font-bold text-slate-900 text-sm">
                            <div className="flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-blue-600" />
                              <span>{pc.studentCount} {pc.studentCount === 1 ? "Student" : "Students"}</span>
                            </div>
                          </td>

                          {/* Col 3: Classification badges */}
                          <td className="py-4 px-6">
                            {pc.isSuspicious ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>More Blocks Than Clears</span>
                              </span>
                            ) : isTenPlusStudents ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200 uppercase">
                                <Building className="w-3 h-3 text-purple-600" />
                                <span>10+ Students</span>
                              </span>
                            ) : isThreeToNineStudents ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 uppercase">
                                <Users className="w-3 h-3 text-blue-600" />
                                <span>3–9 Students</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>1–2 Students</span>
                              </span>
                            )}
                          </td>

                          {/* Col 4: Payments summary */}
                          <td className="py-4 px-6 font-sans">
                            <span className="text-emerald-600 font-extrabold">{pc.clearedCount} Cleared</span>
                            {" / "}
                            <span className={pc.blockedCount > 0 ? "text-rose-600 font-extrabold" : "text-slate-400"}>
                              {pc.blockedCount} Blocked
                            </span>
                          </td>

                          {/* Col 5: Expand row */}
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => toggleExpand(pc.deviceId)}
                              className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1 ml-auto cursor-pointer ${
                                isExpanded
                                  ? "bg-[#001C3D] text-white border-[#001C3D]"
                                  : "bg-slate-100/80 text-slate-700 border-slate-200/80 hover:bg-slate-200"
                              }`}
                            >
                              <span>{isExpanded ? "Hide Students" : "View Students"}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </td>

                        </tr>

                        {/* Expanded row: students who transacted from this device */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 border-b border-slate-200 shadow-inner animate-in fade-in duration-150">
                            <td colSpan={5} className="p-6">
                              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <span className="text-xs font-bold text-[#001C3D] flex items-center gap-1.5">
                                    <Users className="w-4 h-4 text-[#F58220]" />
                                    <span>Students who transacted from this device ({pc.studentCount})</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    Total Transactions: {pc.totalAttempts}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                  {pc.studentsList.map((st: any) => (
                                    <div key={st.matricNumber} className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 flex items-start justify-between gap-2 text-xs">
                                      <div className="min-w-0 flex-1">
                                        <div className="font-bold text-slate-900 truncate">{st.name}</div>
                                        <div className="text-[11px] font-mono text-slate-500 truncate">{st.matricNumber}</div>
                                        <div className="text-[10px] text-slate-400 truncate">{st.department}</div>
                                      </div>

                                      <div className="flex flex-col items-end gap-1 shrink-0">
                                        <div className="flex items-center gap-1 text-[10px] font-mono font-extrabold">
                                          <span className="text-emerald-700">{st.clearedCount} CLEARED</span>
                                          <span className="text-slate-300">·</span>
                                          <span className="text-rose-700">{st.blockedCount} BLOCKED</span>
                                        </div>
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase whitespace-nowrap ${
                                          st.lastStatus === 'CLEARED' ? "bg-emerald-100 text-emerald-800"
                                          : st.lastStatus === 'BLOCKED' ? "bg-rose-100 text-rose-800"
                                          : st.lastStatus === 'PENDING' ? "bg-amber-100 text-amber-800"
                                          : "bg-slate-100 text-slate-800"
                                        }`}>
                                          Latest: {st.lastStatus}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
