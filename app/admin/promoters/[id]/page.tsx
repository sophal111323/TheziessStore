"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { Affiliate, AffiliateStats, AffiliateOrder, AffiliatePayout, AffiliateAdjustment, PayoutMethod } from "@/lib/affiliate/types";

interface PromoterDetailData {
  affiliate: Affiliate;
  stats: AffiliateStats;
  orders: AffiliateOrder[];
  payouts: AffiliatePayout[];
  adjustments?: AffiliateAdjustment[];
}

export default function AdminPromoterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const promoterId = resolvedParams.id;

  const [data, setData] = useState<PromoterDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"orders" | "payouts" | "adjustments">("orders");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // ── Clear Balance Modal State ─────────────────────────────
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearAmount, setClearAmount] = useState("");
  const [clearMethod, setClearMethod] = useState<PayoutMethod>("ABA");
  const [clearAccountName, setClearAccountName] = useState("");
  const [clearAccountNumber, setClearAccountNumber] = useState("");
  const [clearNote, setClearNote] = useState("");
  const [clearing, setClearing] = useState(false);

  // ── Adjust Balance Modal State ────────────────────────────
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustType, setAdjustType] = useState<"ADD" | "DEDUCT">("ADD");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [updatingPayoutId, setUpdatingPayoutId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/promoters/${promoterId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [promoterId]);

  async function handleToggleStatus() {
    if (!data) return;
    const name = data.affiliate.name || data.affiliate.slug;
    const nextStatus = data.affiliate.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const confirmText = data.affiliate.status === "ACTIVE"
      ? `Suspend promoter "${name}"?`
      : `Activate promoter "${name}"?`;

    if (!window.confirm(confirmText)) return;

    setUpdatingStatus(true);
    try {
      const res = await fetch("/api/admin/promoters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliateId: data.affiliate.id,
          status: nextStatus,
        }),
      });

      if (res.ok) {
        setToast(`Status updated to ${nextStatus}`);
        setTimeout(() => setToast(null), 3000);
        await loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to update status");
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  }

  function openClearModal() {
    if (!data) return;
    const bal = data.stats.availableBalance || 0;
    setClearAmount(bal > 0 ? bal.toFixed(2) : "0.00");
    setClearMethod("ABA");
    setClearAccountName(data.affiliate.name || data.affiliate.slug);
    setClearAccountNumber(data.affiliate.phone || "");
    setClearNote(`ទូទាត់ប្រាក់កម្រៃជើងសារជូន ${data.affiliate.name || data.affiliate.slug}`);
    setShowClearModal(true);
  }

  async function handleConfirmClear(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;

    const amt = parseFloat(clearAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("សូមបញ្ចូលចំនួនទឹកប្រាក់ដែលត្រូវ Clear ឱ្យបានត្រឹមត្រូវ (> 0)");
      return;
    }

    if (amt > data.stats.availableBalance) {
      alert(`ចំនួនទឹកប្រាក់ $${amt.toFixed(2)} លើសពីសមតុល្យដែលមាន ($${data.stats.availableBalance.toFixed(2)})`);
      return;
    }

    setClearing(true);
    try {
      const res = await fetch(`/api/admin/promoters/${promoterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_balance",
          amountUsd: amt,
          paymentMethod: clearMethod,
          accountName: clearAccountName,
          accountNumber: clearAccountNumber,
          note: clearNote,
        }),
      });

      const resJson = await res.json();
      if (res.ok && resJson.success) {
        setToast(`បាន Clear លុយ $${amt.toFixed(2)} ជូន ${data.affiliate.name || data.affiliate.slug} រួចរាល់!`);
        setTimeout(() => setToast(null), 3500);
        setShowClearModal(false);
        await loadData();
      } else {
        alert(resJson.error || "Failed to clear balance");
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setClearing(false);
    }
  }

  function openAdjustModal() {
    setAdjustType("ADD");
    setAdjustAmount("");
    setAdjustReason("");
    setShowAdjustModal(true);
  }

  async function handleConfirmAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;

    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("សូមបញ្ចូលចំនួនទឹកប្រាក់ដែលត្រូវកែសម្រួលឱ្យបានត្រឹមត្រូវ (> 0)");
      return;
    }

    if (!adjustReason.trim()) {
      alert("សូមបញ្ចូលមូលហេតុនៃការដក ឬ បន្ថែមលុយនេះ (Reason is required)");
      return;
    }

    if (adjustType === "DEDUCT" && amt > data.stats.availableBalance) {
      alert(`មិនអាចដក $${amt.toFixed(2)} បានទេ ពីព្រោះសមតុល្យបច្ចុប្បន្នមានត្រឹមតែ $${data.stats.availableBalance.toFixed(2)}`);
      return;
    }

    setAdjusting(true);
    try {
      const res = await fetch(`/api/admin/promoters/${promoterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust_balance",
          type: adjustType,
          amountUsd: amt,
          reason: adjustReason.trim(),
        }),
      });

      const resJson = await res.json();
      if (res.ok && resJson.success) {
        setToast(
          adjustType === "ADD"
            ? `បានបន្ថែមលុយ +$${amt.toFixed(2)} ជោគជ័យ!`
            : `បានដកលុយ -$${amt.toFixed(2)} ជោគជ័យ!`
        );
        setTimeout(() => setToast(null), 3500);
        setShowAdjustModal(false);
        await loadData();
      } else {
        alert(resJson.error || "Failed to adjust balance");
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setAdjusting(false);
    }
  }

  async function handleUpdatePayoutStatus(payoutId: string, status: "PAID" | "REJECTED") {
    const confirmMsg = status === "PAID"
      ? "Approve and mark this payout as PAID?"
      : "Reject this payout request?";
    if (!window.confirm(confirmMsg)) return;

    setUpdatingPayoutId(payoutId);
    try {
      const res = await fetch("/api/admin/promoters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_payout_status",
          payoutId,
          status,
        }),
      });

      const resJson = await res.json();
      if (res.ok && resJson.success) {
        setToast(`Payout #${payoutId} marked as ${status}`);
        setTimeout(() => setToast(null), 3000);
        await loadData();
      } else {
        alert(resJson.error || "Failed to update payout status");
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setUpdatingPayoutId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-fox-muted text-sm py-24">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent mb-3" />
        <p>Loading promoter profile & orders...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center py-20">
        <div className="text-4xl mb-3">🔍</div>
        <h2 className="text-xl font-bold font-display text-fox-text mb-2">Promoter Not Found</h2>
        <p className="text-sm text-fox-muted mb-6">The promoter ID #{promoterId} does not exist.</p>
        <Link href="/admin/promoters" className="btn-primary text-xs px-4 py-2">
          ← Back to Promoters
        </Link>
      </div>
    );
  }

  const { affiliate, stats, orders, payouts, adjustments = [] } = data;
  const displayName = affiliate.name || affiliate.slug;
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="p-4 sm:p-8 space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/admin/promoters"
          className="inline-flex items-center gap-1.5 text-xs text-fox-muted hover:text-fox-primary font-semibold transition-colors"
        >
          <span>←</span>
          <span>Back to Promoters</span>
        </Link>
      </div>

      {toast && (
        <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm font-semibold text-green-300 flex items-center justify-between">
          <span>✅ {toast}</span>
          <button onClick={() => setToast(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Hero card */}
      <div className="card p-6 border-purple-500/20 bg-gradient-to-r from-purple-950/40 via-fox-surface/90 to-pink-950/30 backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative h-16 w-16 rounded-2xl bg-black/40 border border-white/10 p-2 shadow-inner flex items-center justify-center shrink-0">
              <Image
                src="/theziessstore-logo-transparent.png"
                alt="Theziess Store Logo"
                width={50}
                height={50}
                className="object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.5)]"
              />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-black font-display text-fox-text">
                  {displayName}
                </h1>
                <span className="rounded-full border border-purple-400/40 bg-purple-500/20 px-2.5 py-0.5 text-xs font-bold text-purple-200 font-mono">
                  $0.04 / Order
                </span>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                    affiliate.status === "ACTIVE"
                      ? "bg-green-500/10 text-green-400 border-green-500/30"
                      : "bg-red-500/10 text-red-400 border-red-500/30"
                  }`}
                >
                  {affiliate.status}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-fox-muted mt-1.5 flex-wrap">
                <span className="font-mono text-purple-400 font-semibold">@{affiliate.slug}</span>
                <span>•</span>
                <span className="font-mono">{affiliate.email}</span>
                {affiliate.phone && (
                  <>
                    <span>•</span>
                    <span className="font-mono">📞 {affiliate.phone}</span>
                  </>
                )}
                {affiliate.telegram && (
                  <>
                    <span>•</span>
                    <span className="text-sky-400 font-mono">✈️ {affiliate.telegram}</span>
                  </>
                )}
                {affiliate.tiktok && (
                  <>
                    <span>•</span>
                    <span className="text-pink-400 font-mono">🎵 {affiliate.tiktok}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Clear Balance Button */}
            <button
              type="button"
              onClick={openClearModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-extrabold text-xs transition-all shadow-sm cursor-pointer"
              title="Clear Available Balance and mark payout as PAID"
            >
              <span>⚡</span>
              <span>Clear Balance (ទូទាត់លុយ)</span>
            </button>

            {/* Adjust Balance (+ / -) Button */}
            <button
              type="button"
              onClick={openAdjustModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 font-extrabold text-xs transition-all shadow-sm cursor-pointer"
              title="Add or deduct money from promoter account"
            >
              <span>⚖️</span>
              <span>ដក ឬ បន្ថែមលុយ (+/-)</span>
            </button>

            <Link
              href={`/${affiliate.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-xs transition-all shadow-sm"
            >
              <span>🌐 Storefront</span>
              <span>↗</span>
            </Link>

            <button
              onClick={handleToggleStatus}
              disabled={updatingStatus}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                affiliate.status === "ACTIVE"
                  ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  : "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20"
              } disabled:opacity-50`}
            >
              {updatingStatus ? "Saving..." : affiliate.status === "ACTIVE" ? "Suspend" : "Activate"}
            </button>
          </div>
        </div>
      </div>

      {/* KPI 6 Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="card p-4">
          <div className="text-[11px] text-fox-muted uppercase tracking-wider font-semibold">Visitors</div>
          <div className="text-2xl font-black font-display text-fox-text mt-1">{stats.visitors}</div>
          <div className="text-[11px] text-fox-muted/80 mt-1">{stats.clicks} clicks</div>
        </div>

        <div className="card p-4">
          <div className="text-[11px] text-fox-muted uppercase tracking-wider font-semibold">Orders</div>
          <div className="text-2xl font-black font-display text-purple-400 mt-1">{stats.orders}</div>
          <div className="text-[11px] text-purple-400/80 mt-1 font-semibold">{stats.conversionRate}% CVR</div>
        </div>

        <div className="card p-4">
          <div className="text-[11px] text-fox-muted uppercase tracking-wider font-semibold">Sales Driven</div>
          <div className="text-2xl font-black font-display text-emerald-400 font-mono mt-1">
            ${stats.totalSales.toFixed(2)}
          </div>
          <div className="text-[11px] text-fox-muted mt-1">{stats.successfulOrders} fulfilled</div>
        </div>

        <div className="card p-4">
          <div className="text-[11px] text-fox-muted uppercase tracking-wider font-semibold">Total Commission</div>
          <div className="text-2xl font-black font-display text-pink-400 font-mono mt-1">
            ${stats.totalCommission.toFixed(2)}
          </div>
          <div className="text-[11px] text-pink-400/80 mt-1 font-semibold">$0.04 per order</div>
        </div>

        <div className="card p-4">
          <div className="text-[11px] text-fox-muted uppercase tracking-wider font-semibold">Pending</div>
          <div className="text-2xl font-black font-display text-amber-300 font-mono mt-1">
            ${stats.pendingCommission.toFixed(2)}
          </div>
          <div className="text-[11px] text-amber-300/80 mt-1">Awaiting hold</div>
        </div>

        <div className="card p-4 border-emerald-500/30 bg-emerald-500/5">
          <div className="text-[11px] text-emerald-400 uppercase tracking-wider font-semibold">Available Balance</div>
          <div className="text-2xl font-black font-display text-emerald-300 font-mono mt-1">
            ${stats.availableBalance.toFixed(2)}
          </div>
          <div className="text-[11px] text-fox-muted mt-1">${stats.paidCommission.toFixed(2)} paid out</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-fox-border pb-3">
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "orders"
              ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
              : "bg-fox-surface text-fox-muted hover:text-fox-text"
          }`}
        >
          <span>📦</span>
          <span>Attributed Orders ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("payouts")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "payouts"
              ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
              : "bg-fox-surface text-fox-muted hover:text-fox-text"
          }`}
        >
          <span>💳</span>
          <span>Payout History ({payouts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("adjustments")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "adjustments"
              ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
              : "bg-fox-surface text-fox-muted hover:text-fox-text"
          }`}
        >
          <span>⚖️</span>
          <span>Adjustments History ({adjustments.length})</span>
        </button>
      </div>

      {/* Tab 1: Orders */}
      {activeTab === "orders" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-fox-surface text-fox-muted text-xs uppercase tracking-wider border-b border-fox-border">
                <tr>
                  <th className="text-left px-5 py-3">Order #</th>
                  <th className="text-left px-5 py-3">Game</th>
                  <th className="text-left px-5 py-3">Product</th>
                  <th className="text-right px-5 py-3">Order Amount</th>
                  <th className="text-right px-5 py-3">Commission ($0.04/order)</th>
                  <th className="text-center px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fox-border">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-fox-muted">
                      No attributed orders recorded for this creator yet.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-fox-surface/40 transition-colors">
                      <td className="px-5 py-3 font-mono font-bold text-fox-primary">
                        {o.orderNumber}
                      </td>
                      <td className="px-5 py-3 font-semibold text-fox-text">{o.gameName}</td>
                      <td className="px-5 py-3 text-fox-muted text-xs">{o.productName}</td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-fox-text">
                        ${o.amountUsd.toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-pink-400">
                        +${o.commissionUsd.toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            o.status === "COMPLETED"
                              ? "bg-green-500/10 text-green-400 border-green-500/30"
                              : o.status === "PENDING"
                              ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                              : "bg-red-500/10 text-red-400 border-red-500/30"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-fox-muted">
                        {new Date(o.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Payouts */}
      {activeTab === "payouts" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-fox-surface text-fox-muted text-xs uppercase tracking-wider border-b border-fox-border">
                <tr>
                  <th className="text-left px-5 py-3">Payout ID</th>
                  <th className="text-left px-5 py-3">Method</th>
                  <th className="text-left px-5 py-3">Account Name</th>
                  <th className="text-left px-5 py-3">Account Number</th>
                  <th className="text-right px-5 py-3">Amount</th>
                  <th className="text-left px-5 py-3">Note / Reason</th>
                  <th className="text-center px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3">Date</th>
                  <th className="text-center px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fox-border">
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-fox-muted">
                      No payout requests for this promoter yet.
                    </td>
                  </tr>
                ) : (
                  payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-fox-surface/40 transition-colors">
                      <td className="px-5 py-3 font-mono font-bold text-fox-primary text-xs">
                        {p.id}
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 font-bold text-xs">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-semibold text-fox-text text-xs">{p.accountName}</td>
                      <td className="px-5 py-3 font-mono text-xs text-fox-muted">{p.accountNumber}</td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-emerald-400">
                        ${p.amountUsd.toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-xs text-fox-muted max-w-[200px] truncate" title={p.note || ""}>
                        {p.note || "—"}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            p.status === "PAID"
                              ? "bg-green-500/10 text-green-400 border-green-500/30"
                              : p.status === "PENDING"
                              ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                              : "bg-red-500/10 text-red-400 border-red-500/30"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-fox-muted">
                        {new Date(p.createdAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-center whitespace-nowrap">
                        {p.status === "PENDING" ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdatePayoutStatus(p.id, "PAID")}
                              disabled={updatingPayoutId === p.id}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 cursor-pointer"
                            >
                              {updatingPayoutId === p.id ? "Saving..." : "Approve ✓"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdatePayoutStatus(p.id, "REJECTED")}
                              disabled={updatingPayoutId === p.id}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 cursor-pointer"
                            >
                              Reject ✕
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-fox-muted font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Adjustments */}
      {activeTab === "adjustments" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-fox-surface text-fox-muted text-xs uppercase tracking-wider border-b border-fox-border">
                <tr>
                  <th className="text-left px-5 py-3">Adjustment ID</th>
                  <th className="text-center px-5 py-3">Type</th>
                  <th className="text-right px-5 py-3">Amount</th>
                  <th className="text-left px-5 py-3">Reason / Note</th>
                  <th className="text-left px-5 py-3">Admin</th>
                  <th className="text-right px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fox-border">
                {adjustments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-fox-muted">
                      No manual balance adjustments recorded for this promoter yet.
                    </td>
                  </tr>
                ) : (
                  adjustments.map((a) => (
                    <tr key={a.id} className="hover:bg-fox-surface/40 transition-colors">
                      <td className="px-5 py-3 font-mono font-bold text-fox-primary text-xs">
                        {a.id}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            a.type === "ADD"
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                              : "bg-rose-500/10 text-rose-300 border-rose-500/30"
                          }`}
                        >
                          {a.type === "ADD" ? "➕ បន្ថែម (Credit)" : "➖ ដក (Debit)"}
                        </span>
                      </td>
                      <td className={`px-5 py-3 text-right font-mono font-bold ${a.type === "ADD" ? "text-emerald-400" : "text-rose-400"}`}>
                        {a.type === "ADD" ? "+" : "-"}${a.amountUsd.toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-xs text-fox-text font-medium">
                        {a.reason}
                      </td>
                      <td className="px-5 py-3 text-xs font-mono text-fox-muted">
                        {a.adminEmail || "Admin"}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-fox-muted">
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Clear Balance Modal ─────────────────────────────────────── */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-fox-surface border border-purple-500/30 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-auto">
            <div className="flex items-start justify-between gap-3 border-b border-purple-500/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 text-lg font-black shrink-0">
                  ⚡
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white font-display">
                    ទូទាត់ និង Clear លុយ Promoter
                  </h3>
                  <p className="text-xs text-fox-muted">
                    Clear Balance សម្រាប់ <strong className="text-purple-300">{displayName}</strong> (@{affiliate.slug})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="text-fox-muted hover:text-white text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmClear} className="space-y-4">
              {/* Balance card */}
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase font-bold text-amber-300/80">សមតុល្យបច្ចុប្បន្ន (Available Balance)</div>
                  <div className="text-2xl font-black font-mono text-amber-300 mt-0.5">
                    ${stats.availableBalance.toFixed(2)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setClearAmount(stats.availableBalance.toFixed(2))}
                  className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-bold border border-amber-500/40 transition-all cursor-pointer"
                >
                  Clear ទាំងអស់ (Full)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-fox-muted mb-1.5">
                  ចំនួនទឹកប្រាក់ដែលត្រូវ Clear (USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={stats.availableBalance.toFixed(2)}
                  value={clearAmount}
                  onChange={(e) => setClearAmount(e.target.value)}
                  className="input text-base font-mono font-bold w-full bg-purple-950/40 border-purple-500/30 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-fox-muted mb-1.5">
                    វិធីសាស្រ្តផ្ទេរប្រាក់ (Method) *
                  </label>
                  <select
                    value={clearMethod}
                    onChange={(e) => setClearMethod(e.target.value as any)}
                    className="input text-xs w-full bg-purple-950/40 border-purple-500/30 text-white cursor-pointer"
                  >
                    <option value="ABA">ABA Bank</option>
                    <option value="WING">Wing Bank</option>
                    <option value="ACLEDA">ACLEDA Bank</option>
                    <option value="TRUE_MONEY">TrueMoney</option>
                    <option value="CASH">Cash (សាច់ប្រាក់សុទ្ធ)</option>
                    <option value="OTHER">ផ្សេងៗ (Other)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-fox-muted mb-1.5">
                    ឈ្មោះគណនី (Account Name)
                  </label>
                  <input
                    type="text"
                    value={clearAccountName}
                    onChange={(e) => setClearAccountName(e.target.value)}
                    placeholder="e.g. SOK PHAL"
                    className="input text-xs w-full bg-purple-950/40 border-purple-500/30 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-fox-muted mb-1.5">
                  លេខគណនី / លេខទូរស័ព្ទ (Account # / Phone)
                </label>
                <input
                  type="text"
                  value={clearAccountNumber}
                  onChange={(e) => setClearAccountNumber(e.target.value)}
                  placeholder="e.g. 001 234 567"
                  className="input text-xs w-full bg-purple-950/40 border-purple-500/30 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-fox-muted mb-1.5">
                  កំណត់ចំណាំ (Note)
                </label>
                <input
                  type="text"
                  value={clearNote}
                  onChange={(e) => setClearNote(e.target.value)}
                  placeholder="e.g. បានផ្ទេរប្រាក់កម្រៃជើងសាររួចរាល់"
                  className="input text-xs w-full bg-purple-950/40 border-purple-500/30 text-white"
                />
              </div>

              <div className="rounded-xl bg-purple-950/50 border border-purple-800/40 p-3 text-[11px] text-purple-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <span>ℹ️</span>
                  <span>ព័ត៌មានប្រតិបត្តិការ៖</span>
                </div>
                <p>
                  ពេលចុចបញ្ជាក់ ប្រព័ន្ធនឹងកត់ត្រាការទូទាត់នេះចូលក្នុង <strong>Payout History</strong> ជាស្ថានភាព <strong className="text-emerald-300">PAID</strong> ហើយសមតុល្យរបស់ Promoter នឹងត្រូវកាត់ចេញភ្លាមៗ។ គាត់នឹងអាចប្រមូលកម្រៃជើងសារពីការកុម្ម៉ង់ថ្មីៗចាប់ពី $0.00 ឡើងវិញ។
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-purple-500/20">
                <button
                  type="button"
                  onClick={() => setShowClearModal(false)}
                  disabled={clearing}
                  className="btn-ghost text-xs px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={clearing}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-extrabold text-xs shadow-lg shadow-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>⚡</span>
                  <span>{clearing ? "កំពុងដំណើរការ..." : "បញ្ជាក់ការ Clear & ទូទាត់ប្រាក់"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Adjust Balance (+ / -) Modal ────────────────────────────── */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-fox-surface border border-purple-500/30 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-auto">
            <div className="flex items-start justify-between gap-3 border-b border-purple-500/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 text-lg font-black shrink-0">
                  ⚖️
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white font-display">
                    ដក ឬ បន្ថែមលុយលើអាខោន Promoter
                  </h3>
                  <p className="text-xs text-fox-muted">
                    កែសម្រួលសមតុល្យសម្រាប់ <strong className="text-purple-300">{displayName}</strong> (@{affiliate.slug})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="text-fox-muted hover:text-white text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAdjust} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustType("ADD")}
                  className={`p-3 rounded-2xl border text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    adjustType === "ADD"
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 font-extrabold shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400"
                      : "bg-purple-950/30 border-purple-800/40 text-fox-muted hover:text-white"
                  }`}
                >
                  <span className="text-base">➕</span>
                  <span className="text-xs">បន្ថែមលុយ (Add Credit)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAdjustType("DEDUCT")}
                  className={`p-3 rounded-2xl border text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    adjustType === "DEDUCT"
                      ? "bg-rose-500/20 border-rose-400 text-rose-300 font-extrabold shadow-md shadow-rose-500/20 ring-1 ring-rose-400"
                      : "bg-purple-950/30 border-purple-800/40 text-fox-muted hover:text-white"
                  }`}
                >
                  <span className="text-base">➖</span>
                  <span className="text-xs">ដកលុយ (Deduct)</span>
                </button>
              </div>

              {/* Balance & Preview calculation */}
              <div className="rounded-2xl bg-purple-950/40 border border-purple-800/40 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-fox-muted">សមតុល្យបច្ចុប្បន្ន (Current):</span>
                  <span className="font-mono font-bold text-white">
                    ${stats.availableBalance.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-fox-muted">ចំនួនកែសម្រួល (Adjustment):</span>
                  <span className={`font-mono font-bold ${adjustType === "ADD" ? "text-emerald-400" : "text-rose-400"}`}>
                    {adjustType === "ADD" ? "+" : "-"}${parseFloat(adjustAmount || "0").toFixed(2)}
                  </span>
                </div>
                <div className="h-px bg-purple-800/40 my-1" />
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-purple-200">សមតុល្យថ្មី (New Balance):</span>
                  <span className="font-mono text-base text-amber-300">
                    ${Math.max(
                      0,
                      stats.availableBalance +
                        (adjustType === "ADD" ? 1 : -1) * (parseFloat(adjustAmount || "0") || 0)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-fox-muted mb-1.5">
                  ចំនួនទឹកប្រាក់ដែលត្រូវ{adjustType === "ADD" ? "បន្ថែម" : "ដក"} (USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="e.g. 5.00"
                  className="input text-base font-mono font-bold w-full bg-purple-950/40 border-purple-500/30 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-fox-muted mb-1.5">
                  មូលហេតុ / កំណត់ចំណាំ (Reason) *
                </label>
                <textarea
                  rows={2}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder={
                    adjustType === "ADD"
                      ? "e.g. ប្រាក់រង្វាន់លើកទឹកចិត្ត TikTok Campaign ឬ Bonus ប្រចាំខែ"
                      : "e.g. កែតម្រូវការទូទាត់លើស ឬ ដកប្រាក់ពិន័យ"
                  }
                  className="input text-xs w-full bg-purple-950/40 border-purple-500/30 text-white resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-purple-500/20">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  disabled={adjusting}
                  className="btn-ghost text-xs px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className={`px-5 py-2.5 rounded-xl text-black font-extrabold text-xs shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    adjustType === "ADD"
                      ? "bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-500 hover:to-green-600 shadow-emerald-500/30"
                      : "bg-gradient-to-r from-rose-500 to-red-600 text-white hover:from-rose-600 hover:to-red-700 shadow-rose-500/30"
                  }`}
                >
                  <span>{adjustType === "ADD" ? "➕" : "➖"}</span>
                  <span>{adjusting ? "កំពុងរក្សាទុក..." : "រក្សាទុកការកែសម្រួល"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
