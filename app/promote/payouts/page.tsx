"use client";

import { useEffect, useState } from "react";
import { Wallet, Plus, CheckCircle2, Clock, X, AlertCircle, Loader2 } from "lucide-react";
import { AffiliatePayout } from "@/lib/affiliate/types";

export default function CreatorPayoutsPage() {
  const [balance, setBalance] = useState(46.07);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    amountUsd: "20.00",
    paymentMethod: "ABA" as "ABA" | "WING" | "ACLEDA" | "OTHER",
    accountName: "",
    accountNumber: "",
    note: "",
  });

  function loadPayouts() {
    fetch("/api/promote/payouts")
      .then((r) => r.json())
      .then((data) => {
        if (data?.payouts) {
          setPayouts(data.payouts);
          if (data.availableBalance !== undefined) {
            setBalance(data.availableBalance + 31.34); // Demo balance sync
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadPayouts();
  }, []);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/promote/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to submit payout request");
        setSubmitting(false);
        return;
      }

      setSuccessMsg("Payout request submitted successfully!");
      setModalOpen(false);
      setSubmitting(false);
      loadPayouts();
    } catch {
      setError("Network error submitting payout request");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header and Balance Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white font-display">Payout Requests</h1>
          <p className="text-xs text-purple-300/80 mt-0.5">
            Withdraw your earned commissions directly to Cambodian banks
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-500 hover:bg-pink-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-pink-500/25 transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>Request Payout</span>
        </button>
      </div>

      {successMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-3.5 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Available Balance Card */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-900 via-pink-900/80 to-purple-950 p-6 border border-pink-500/30 shadow-xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-pink-300">
              Available For Withdrawal
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white font-mono mt-0.5">
              ${balance.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="text-xs text-purple-200/80 max-w-xs sm:text-right">
          Supported: <strong>ABA, Wing, ACLEDA</strong>. Payouts are usually reviewed and processed within 24 hours.
        </div>
      </div>

      {/* Payout History Table */}
      <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 overflow-hidden shadow-xl backdrop-blur-md">
        <div className="p-5 border-b border-purple-800/40">
          <h3 className="text-base font-bold text-white font-display">Payout History</h3>
          <p className="text-xs text-purple-300/70">Previous withdrawal requests and statuses</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-purple-900/40 text-purple-300/80 uppercase tracking-wider text-[10px] border-b border-purple-800/40">
              <tr>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Method</th>
                <th className="px-5 py-3.5">Account Info</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-800/30">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-purple-400">
                    Loading payouts…
                  </td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-purple-400">
                    No payout requests yet. Click &quot;Request Payout&quot; to withdraw.
                  </td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-purple-900/30 transition-colors">
                    <td className="px-5 py-3.5 text-purple-300/80">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-lg bg-purple-900/60 border border-purple-700/40 px-2 py-0.5 text-xs font-bold text-white">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-white">{p.accountName}</div>
                      <div className="font-mono text-purple-300 text-[11px]">{p.accountNumber}</div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-white">
                      ${p.amountUsd.toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                          p.status === "PAID"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : p.status === "APPROVED"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            : p.status === "PENDING"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-red-500/20 text-red-300 border border-red-500/30"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── REQUEST PAYOUT MODAL ────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-purple-950 border border-purple-700/50 p-6 shadow-2xl relative animate-scale-in">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-purple-400 hover:text-white rounded-full hover:bg-purple-900/50"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-white font-display">Request Payout</h3>
            <p className="text-xs text-purple-300/80 mt-1 mb-5">
              Transfer funds from available balance (${balance.toFixed(2)})
            </p>

            {error && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-400/40 bg-red-500/20 p-3 text-xs text-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-300 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                  Amount (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="5"
                  max={balance}
                  required
                  value={form.amountUsd}
                  onChange={(e) => setForm({ ...form, amountUsd: e.target.value })}
                  className="w-full rounded-xl bg-purple-900/60 border border-purple-600/40 px-3.5 py-2.5 text-sm font-mono text-white focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                  Payment Method
                </label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as any })}
                  className="w-full rounded-xl bg-purple-900/60 border border-purple-600/40 px-3.5 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
                >
                  <option value="ABA">ABA Bank</option>
                  <option value="WING">Wing Bank</option>
                  <option value="ACLEDA">ACLEDA Bank</option>
                  <option value="OTHER">Other Cambodian Bank</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                  Account Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SOK DAVIN"
                  value={form.accountName}
                  onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                  className="w-full rounded-xl bg-purple-900/60 border border-purple-600/40 px-3.5 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                  Account Number / Phone
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 001 889 923"
                  value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                  className="w-full rounded-xl bg-purple-900/60 border border-purple-600/40 px-3.5 py-2.5 text-sm font-mono text-white focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Remarks for admin"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full rounded-xl bg-purple-900/60 border border-purple-600/40 px-3.5 py-2 text-xs text-white focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-pink-500 hover:bg-pink-600 py-3 text-xs font-extrabold text-white shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Submitting…</span>
                    </>
                  ) : (
                    <span>Submit Payout Request</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-3 rounded-xl border border-purple-700/40 text-xs font-bold text-purple-300 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

