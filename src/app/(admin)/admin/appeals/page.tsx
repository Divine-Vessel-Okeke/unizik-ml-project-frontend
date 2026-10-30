// src/app/(admin)/admin/appeals/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, XCircle, CheckCircle2, AlertTriangle, RefreshCw, Cpu, FileText, Search, ChevronDown, ChevronUp, Clock, User } from "lucide-react";
import AdminHeader from "@/components/AdminHeader";
import BackButton from "@/components/BackButton";
import { MSG } from "@/lib/messages";
import { isAdminRole } from "@/lib/roles";

export default function AdminAppealsPage() {
  const router = useRouter();
  const [appeals, setAppeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter, search, and modal state
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Rejection Modal State & Templates
  const [rejectModal, setRejectModal] = useState<{ id: string; studentName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchAppeals = () => {
    setLoading(true);
    fetch("/api/appeals")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAppeals(data.appeals);
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
    fetchAppeals();
  }, [router]);

  const handleAction = async (appealId: string, status: "APPROVED" | "REJECTED") => {
    setActionLoading(appealId);
    const noteText = `Admin decision recorded on ${new Date().toLocaleDateString()}`;

    try {
      const res = await fetch("/api/appeals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appealId,
          status,
          adminNotes: noteText,
        }),
      });

      if (res.ok) {
        // Update only the affected row after server confirms — no full-table refetch, no flash.
        setAppeals((prev) =>
          prev.map((a) =>
            a.id === appealId ? { ...a, status, adminNotes: noteText } : a
          )
        );
        setExpandedId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || MSG.GENERIC_ERROR);
      }
    } catch {
      alert(MSG.GENERIC_ERROR);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModal) return;
    const finalReason =
      rejectReason.trim() ||
      `Rejected by admin on ${new Date().toLocaleDateString()}.`;

    setActionLoading(rejectModal.id);
    try {
      const res = await fetch("/api/appeals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appealId: rejectModal.id,
          status: "REJECTED",
          adminNotes: finalReason,
        }),
      });

      if (res.ok) {
        // Update only the affected row after server confirms — no flash.
        setAppeals((prev) =>
          prev.map((a) =>
            a.id === rejectModal.id
              ? { ...a, status: "REJECTED", adminNotes: finalReason }
              : a
          )
        );
        setRejectModal(null);
        setRejectReason("");
        setExpandedId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || MSG.GENERIC_ERROR);
      }
    } catch {
      alert(MSG.GENERIC_ERROR);
    } finally {
      setActionLoading(null);
    }
  };

  // Multi-word search across student fields and fee category
  const filteredAppeals = appeals.filter((item) => {
    const matchesStatus = filterStatus === "ALL" || item.status === filterStatus;

    const combinedSearchIndex = [
      item.student?.firstName || "",
      item.student?.lastName || "",
      item.student?.lastName || "",
      item.student?.firstName || "",
      item.student?.matricNumber || "",
      item.student?.department || "",
      item.transaction?.invoice?.category?.replace("_", " ") || ""
    ].join(" ").toLowerCase();

    const searchWords = searchQuery.trim().toLowerCase().split(/\s+/);
    const matchesSearch = searchWords.every((word) => combinedSearchIndex.includes(word));

    return matchesStatus && matchesSearch;
  });

  const counts = {
    ALL: appeals.length,
    PENDING: appeals.filter((a) => a.status === "PENDING").length,
    APPROVED: appeals.filter((a) => a.status === "APPROVED").length,
    REJECTED: appeals.filter((a) => a.status === "REJECTED").length,
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans pb-16 selection:bg-[#001C3D] selection:text-white">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <BackButton />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#001C3D] tracking-tight">
              Appeals
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Admins can approve or reject appeals. Approval sets the invoice back to PENDING so the student can retry checkout. Audit logs are not deleted.
            </p>
          </div>
          <button
            onClick={fetchAppeals}
            disabled={loading}
            className="self-start md:self-auto px-4 py-2.5 bg-white border border-slate-200/80 hover:border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#F58220] ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            {(["PENDING", "ALL", "APPROVED", "REJECTED"] as const).map((tab) => {
              const isActive = filterStatus === tab;
              const badgeCount = counts[tab];

              return (
                <button
                  key={tab}
                  onClick={() => setFilterStatus(tab)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-[#001C3D] text-white shadow-sm"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60"
                  }`}
                >
                  <span>
                    {tab === "ALL" ? "All Appeals" :
                     tab === "PENDING" ? "Pending Review" :
                     tab === "APPROVED" ? "Approved" : "Rejected"}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                    isActive
                      ? "bg-[#F58220] text-white font-extrabold"
                      : "bg-slate-200/80 text-slate-700"
                  }`}>
                    {badgeCount}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[280px] sm:min-w-[320px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by matric no, student name, or fee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#001C3D] focus:ring-2 focus:ring-[#001C3D]/10 transition-all"
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

        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-slate-400 font-medium flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-[#001C3D]/20 border-t-[#001C3D] rounded-full animate-spin" />
              <span className="text-xs font-semibold">Loading appeals...</span>
            </div>
          ) : filteredAppeals.length === 0 ? (
            <div className="p-16 text-center text-slate-400 font-medium space-y-1">
              <div className="text-sm font-bold text-slate-600">No matching appeals found</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/80 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-6">Student Identification</th>
                    <th className="py-3.5 px-6">Fee Obligation</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6">Details</th>
                    <th className="py-3.5 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredAppeals.map((item) => {
                    const isPending = item.status === "PENDING";
                    const isExpanded = expandedId === item.id;
                    const auditLog = item.transaction?.auditLog;
                    const invoice = item.transaction?.invoice;
                    const student = item.student;
                    const confidenceText = auditLog?.confidence != null
                      ? `${(auditLog.confidence * 100).toFixed(1)}%`
                      : "N/A";

                    return (
                      <React.Fragment key={item.id}>
                        <tr className={`hover:bg-blue-50/30 transition-colors ${isExpanded ? "bg-blue-50/20" : ""}`}>

                          <td className="py-4 px-6">
                            <div className="font-extrabold text-[#001C3D] text-sm flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{student?.lastName} {student?.firstName}</span>
                            </div>
                            <div className="font-mono text-slate-500 font-semibold mt-0.5">
                              {student?.matricNumber} &bull; <span className="font-sans font-normal">{student?.department}</span>
                            </div>
                          </td>

                          <td className="py-4 px-6 font-mono">
                            <div className="font-bold text-slate-900 font-sans">
                              {invoice?.category?.replace("_", " ")}
                            </div>
                            <div className="text-emerald-600 font-extrabold mt-0.5">
                              ₦{invoice?.amount?.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              item.status === "APPROVED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                              item.status === "REJECTED"
                                ? "bg-rose-50 text-rose-700 border border-rose-200" :
                                "bg-amber-50 text-amber-800 border border-amber-200/80 animate-pulse"
                            }`}>
                              {item.status === "APPROVED" && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                              {item.status === "REJECTED" && <XCircle className="w-3 h-3 text-rose-600" />}
                              {item.status === "PENDING" && <Clock className="w-3 h-3 text-amber-600" />}
                              <span>{item.status}</span>
                            </span>
                          </td>

                          <td className="py-4 px-6">
                            <button
                              onClick={() => toggleExpand(item.id)}
                              className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                isExpanded
                                  ? "bg-[#001C3D] text-white border-[#001C3D]"
                                  : "bg-slate-100/80 text-slate-700 border-slate-200/80 hover:bg-slate-200"
                              }`}
                            >
                              <Cpu className={`w-3.5 h-3.5 ${isExpanded ? "text-[#F58220]" : "text-slate-500"}`} />
                              <span>{isExpanded ? "Hide Details" : "View Details"}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                            </button>
                          </td>

                          <td className="py-4 px-6 text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  disabled={actionLoading === item.id}
                                  onClick={() => {
                                    setRejectModal({ id: item.id, studentName: `${student?.lastName} ${student?.firstName}` });
                                    setRejectReason("");
                                  }}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200/80 hover:border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                                >
                                  Reject
                                </button>
                                <button
                                  disabled={actionLoading === item.id}
                                  onClick={() => handleAction(item.id, "APPROVED")}
                                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-semibold italic">
                                Review Concluded
                              </span>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/80 border-b border-slate-200 shadow-inner animate-in fade-in duration-150">
                            <td colSpan={5} className="p-6">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                                {/* Student's reason & admin notes */}
                                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-2xs space-y-3">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#001C3D] flex items-center gap-1.5">
                                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                                      <span>Student&apos;s Reason</span>
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono font-medium">
                                      Submitted: {new Date(item.createdAt).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-700 font-medium leading-relaxed italic bg-slate-50 p-3.5 rounded-lg border border-slate-200/60">
                                    &ldquo;{item.reason}&rdquo;
                                  </p>

                                  {item.adminNotes && (
                                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-rose-700 block flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                                        <span>Admin Notes:</span>
                                      </span>
                                      <p className="text-xs text-rose-950 font-medium leading-relaxed bg-rose-50/80 p-3.5 rounded-lg border border-rose-200/60 font-sans">
                                        {item.adminNotes}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* AI explanation */}
                                <div className="bg-rose-50/40 border border-rose-200/80 p-5 rounded-xl shadow-2xs space-y-2.5">
                                  <div className="flex items-center justify-between border-b border-rose-200/60 pb-2.5">
                                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-rose-900 flex items-center gap-1.5">
                                      <Cpu className="w-3.5 h-3.5 text-rose-600" />
                                      <span>AI Explanation</span>
                                    </span>
                                    <span className="text-[10px] font-bold text-rose-800 bg-rose-100/80 border border-rose-200 px-2 py-0.5 rounded font-mono">
                                      CONFIDENCE: {confidenceText}
                                    </span>
                                  </div>
                                  <p className="text-xs text-rose-950 font-semibold leading-relaxed bg-white/80 p-3.5 rounded-lg border border-rose-200/60 font-mono">
                                    {auditLog?.explanation || "No AI explanation recorded."}
                                  </p>
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

        {/* Rejection modal */}
        {rejectModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">

              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-[#001C3D] flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                    <span>Specify Rejection Reason</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Student: <span className="font-bold text-slate-800">{rejectModal.studentName}</span>
                  </p>
                </div>
                <button
                  onClick={() => setRejectModal(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm px-2 py-1 rounded-lg bg-slate-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Quick-Select Reasons:
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    "Device fingerprint does not match login baseline.",
                    "Network origin not among the 5 major Nigerian telcos (MTN, Glo, Airtel, 9Mobile, Etisalat) during checkout attempt.",
                    "Visit the admin office to explain.",
                  ].map((template, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRejectReason(template)}
                      className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-[#001C3D] hover:bg-blue-50/30 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">
                  Custom Admin Note:
                </label>
                <textarea
                  rows={3}
                  placeholder="Type specific instructions for the student..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#001C3D] focus:ring-2 focus:ring-[#001C3D]/10"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setRejectModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={actionLoading === rejectModal.id}
                  onClick={handleRejectSubmit}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>Confirm Rejection</span>
                </button>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
