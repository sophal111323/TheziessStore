"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Affiliate, AffiliateStats, AffiliateOrder, AffiliatePayout } from "@/lib/affiliate/types";

interface PromoterDetailData {
  affiliate: Affiliate;
  stats: AffiliateStats;
  orders: AffiliateOrder[];
  payouts: AffiliatePayout[];
}

export default function AdminPromoterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const promoterId = resolvedParams.id;

  const [data, setData] = useState<PromoterDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"orders" | "payouts">("orders");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  const { affiliate, stats, orders, payouts } = data;
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
      <div className="card p-6 border-purple-500/20 bg-gradient-to-r from-purple-950/30 via-fox-surface to-fox-surface">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-600 via-pink-600 to-rose-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-purple-900/40 shrink-0">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-black font-display text-fox-text">
                  {displayName}
                </h1>
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

          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href={`/${affiliate.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 font-bold text-xs transition-all shadow-sm"
            >
              <span>🌐 Open Storefront (/{affiliate.slug})</span>
              <span>↗</span>
            </Link>

            <button
              onClick={handleToggleStatus}
              disabled={updatingStatus}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                affiliate.status === "ACTIVE"
                  ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  : "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20"
              } disabled:opacity-50`}
            >
              {updatingStatus ? "Saving..." : affiliate.status === "ACTIVE" ? "Suspend Promoter" : "Activate Promoter"}
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
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "payouts"
              ? "bg-purple-600 text-white shadow-md shadow-purple-900/30"
              : "bg-fox-surface text-fox-muted hover:text-fox-text"
          }`}
        >
          <span>💳</span>
          <span>Payout History ({payouts.length})</span>
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
                  <th className="text-right px-5 py-3">Commission (5%)</th>
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
                  <th className="text-center px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3">Requested At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fox-border">
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-fox-muted">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
