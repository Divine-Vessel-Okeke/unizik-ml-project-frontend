// src/app/support/appeal/page.tsx
"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert, Send, CheckCircle2, AlertCircle } from "lucide-react";
import StudentHeader from "@/components/StudentHeader";
import BackButton from "@/components/BackButton";
import { MSG } from "@/lib/messages";

// Inner form receives the URL param as prop. Remounts on invoiceId change
// via the key prop in <AppealFormKeyed> so the previous success screen
// does not persist when a different invoice is selected.
function AppealForm({ preselectedInvoiceId }: { preselectedInvoiceId: string }) {
  const router = useRouter();

  const [user, setUser] = useState<any | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState(preselectedInvoiceId || "");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("unizik_user");
    if (!storedUser) {
      router.push("/login");
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    // Keep invoices that are blocked and have no PENDING or APPROVED appeal.
    fetch(`/api/invoices?studentId=${parsedUser.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const blockedInvoices = data.invoices.filter((inv: any) => {
            const latestTx = inv.transactions?.[0];
            const appealStatus = latestTx?.appeal?.status;
            return (
              (inv.status === "BLOCKED" || latestTx?.status === "BLOCKED") &&
              appealStatus !== "APPROVED" &&
              appealStatus !== "PENDING"
            );
          });
          setInvoices(blockedInvoices);

          if (!preselectedInvoiceId && blockedInvoices.length > 0) {
            setSelectedInvoice((prev) => prev || blockedInvoices[0].id);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [router, preselectedInvoiceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !reason.trim()) {
      setError("Select an invoice and enter a reason.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: user.id,
          invoiceId: selectedInvoice,
          reason: reason.trim()
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setError(data.error || MSG.GENERIC_ERROR);
      }
    } catch (err) {
      setError(MSG.GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 font-medium">Loading...</div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 mt-8">
      <BackButton />
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-[#001C3D]">Appeal a Blocked Invoice</h1>
            <p className="text-xs text-slate-500 font-medium">Submit an appeal for a blocked payment.</p>
          </div>
        </div>

        {success ? (
          <div className="text-center py-6 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="font-extrabold text-[#001C3D] text-base">Appeal Submitted</h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
              Your appeal has been recorded. An admin can approve or reject it. Approval sets the invoice back to PENDING so you can retry checkout.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-6 py-2.5 bg-[#001C3D] text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="font-extrabold text-[#001C3D] text-base">
              No blocked invoices need an appeal right now.
            </h3>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 px-6 py-2.5 bg-[#001C3D] hover:bg-[#00152e] text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-1">
                Select Blocked Invoice
              </label>
              <select
                value={selectedInvoice}
                onChange={(e) => setSelectedInvoice(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-[#001C3D]"
              >
                <option value="">-- Choose Invoice --</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.category.replace("_", " ")} ({inv.session}) — ₦{inv.amount.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase text-[10px] tracking-wider mb-1">
                Reason
              </label>
              <p className="text-[11px] text-slate-400 mb-2">
                Explain why this payment attempt should be reviewed.
              </p>
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter your reason..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#001C3D]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-[#001C3D] hover:bg-[#00152e] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 mt-2"
            >
              <Send className="w-4 h-4 text-[#F58220]" />
              <span>{submitting ? "Submitting..." : "Submit Appeal"}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// Reads the URL param and uses it as the key on <AppealForm>, forcing a
// remount (state reset) whenever the param changes.
function AppealFormKeyed() {
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("invoiceId") || "";
  return <AppealForm key={invoiceId || "no-param"} preselectedInvoiceId={invoiceId} />;
}

export default function AppealPage() {
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("unizik_user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans pb-16">
      <StudentHeader user={user} />
      <Suspense fallback={<div className="text-center py-12">Loading portal...</div>}>
        <AppealFormKeyed />
      </Suspense>
    </div>
  );
}