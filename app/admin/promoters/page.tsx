"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Affiliate, AffiliateStats } from "@/lib/affiliate/types";

interface PromoterWithStats extends Affiliate {
  stats: AffiliateStats;
}

export default function AdminPromotersPage() {
  const [promoters, setPromoters] = useState<PromoterWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promoters");
      if (res.ok) {
        const data = await res.json();
        setPromoters(data.promoters || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggleStatus(promoter: PromoterWithStats) {
    const nextStatus = promoter.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const confirmText = promoter.status === "ACTIVE"
      ? `Are you sure you want to suspend promoter "${promoter.name}" (@${promoter.slug})? Their referral link will become inactive.`
      : `Activate promoter "${promoter.name}" (@${promoter.slug})?`;

    if (!window.confirm(confirmText)) return;

    setUpdatingId(promoter.id);
    try {
      const res = await fetch("/api/admin/promoters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliateId: promoter.id,
          status: nextStatus,
        }),
      });

      if (res.ok) {
        setToast(`Updated ${promoter.name} status to ${nextStatus}`);
        setTimeout(() => setToast(null), 3500);
        await load();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to update promoter status");
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  }

  const filtered = promoters.filter((p) => {
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    if (!q) return true;
    const query = q.toLowerCase();
    return (
      (p.name || "").toLowerCase().includes(query) ||
      p.slug.toLowerCase().includes(query) ||
      p.email.toLowerCase().includes(query) ||
      (p.phone && p.phone.includes(query)) ||
      (p.telegram && p.telegram.toLowerCase().includes(query)) ||
      (p.tiktok && p.tiktok.toLowerCase().includes(query))
    );
  });

  const totalSales = promoters.reduce((acc, p) => acc + (p.stats?.totalSales || 0), 0);
  const totalCommission = promoters.reduce((acc, p) => acc + (p.stats?.totalCommission || 0), 0);
  const activeCount = promoters.filter((p) => p.status === "ACTIVE").length;

  return (
    <div className="p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold flex items-center gap-2.5">
            <span>🤝</span>
            <span>Promoters & Content Creators</span>
          </h1>
          <p className="text-fox-muted text-sm mt-1">
            Manage creator referral storefronts, sales attribution, and commission balances.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load()}
            disabled={loading}
            className="btn-ghost text-xs px-3 py-2 flex items-center gap-1.5"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm font-semibold text-green-300 flex items-center justify-between">
          <span>✅ {toast}</span>
          <button onClick={() => setToast(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs text-fox-muted uppercase tracking-wider font-semibold">Total Promoters</div>
          <div className="text-2xl font-black font-display text-fox-text mt-1">{promoters.length}</div>
          <div className="text-xs text-green-400 mt-1">{activeCount} active</div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-fox-muted uppercase tracking-wider font-semibold">Total Orders Driven</div>
          <div className="text-2xl font-black font-display text-purple-400 mt-1">
            {promoters.reduce((acc, p) => acc + (p.stats?.orders || 0), 0)}
          </div>
          <div className="text-xs text-fox-muted mt-1">Across all creators</div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-fox-muted uppercase tracking-wider font-semibold">Total Sales Driven</div>
          <div className="text-2xl font-black font-display text-emerald-400 font-mono mt-1">
            ${totalSales.toFixed(2)}
          </div>
          <div className="text-xs text-fox-muted mt-1">Gross GMV</div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-fox-muted uppercase tracking-wider font-semibold">Total Commission</div>
          <div className="text-2xl font-black font-display text-pink-400 font-mono mt-1">
            ${totalCommission.toFixed(2)}
          </div>
          <div className="text-xs text-fox-muted mt-1">Fixed 5% creator share</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {(["ALL", "ACTIVE", "SUSPENDED"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-all ${
                statusFilter === st
                  ? "bg-fox-primary text-black shadow-sm"
                  : "bg-fox-surface text-fox-muted hover:text-fox-text hover:bg-fox-border"
              }`}
            >
              {st === "ALL" ? `All (${promoters.length})` : st === "ACTIVE" ? `Active (${activeCount})` : `Suspended (${promoters.length - activeCount})`}
            </button>
          ))}
        </div>

        <div className="flex-1 max-w-sm">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search creator name, slug, telegram, email..."
            className="input text-xs w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-fox-surface text-fox-muted text-xs uppercase tracking-wider border-b border-fox-border">
              <tr>
                <th className="text-left px-5 py-3">Creator / Promoter</th>
                <th className="text-left px-5 py-3">Branded Storefront</th>
                <th className="text-left px-5 py-3">Contact</th>
                <th className="text-right px-5 py-3">Orders</th>
                <th className="text-right px-5 py-3">Total Sales</th>
                <th className="text-right px-5 py-3">Commission</th>
                <th className="text-right px-5 py-3">Available</th>
                <th className="text-center px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-fox-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-fox-muted">
                    Loading promoters...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center">
                    <div className="text-4xl mb-2">🤝</div>
                    <p className="text-fox-muted font-medium">No promoters match your search</p>
                    <p className="text-xs text-fox-muted/60 mt-1">Try clearing filters or search terms</p>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const promoterName = p.name || p.slug;
                  const initials = promoterName
                    .split(" ")
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <tr key={p.id} className="hover:bg-fox-surface/40 transition-colors">
                      {/* Creator info */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-black text-sm shadow-sm shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/admin/promoters/${p.id}`}
                              className="font-bold text-fox-text hover:text-fox-primary transition-colors text-sm truncate block"
                            >
                              {promoterName}
                            </Link>
                            <div className="text-xs text-fox-muted truncate font-mono">{p.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Branded Link */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/${p.slug}`}
                            target="_blank"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 font-mono text-xs font-semibold hover:bg-purple-500/20 hover:text-purple-200 transition-colors"
                          >
                            <span>/{p.slug}</span>
                            <span className="text-[10px]">↗</span>
                          </Link>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/${p.slug}`);
                              setToast(`Copied ${window.location.origin}/${p.slug} to clipboard`);
                              setTimeout(() => setToast(null), 2500);
                            }}
                            title="Copy link"
                            className="text-fox-muted hover:text-fox-text p-1 text-xs"
                          >
                            📋
                          </button>
                        </div>
                      </td>

                      {/* Contact & Socials */}
                      <td className="px-5 py-4 text-xs">
                        <div className="space-y-0.5">
                          {p.telegram && (
                            <div className="text-sky-400 font-mono flex items-center gap-1">
                              <span>✈️</span>
                              <span>{p.telegram}</span>
                            </div>
                          )}
                          {p.phone && (
                            <div className="text-fox-muted font-mono flex items-center gap-1">
                              <span>📞</span>
                              <span>{p.phone}</span>
                            </div>
                          )}
                          {p.tiktok && (
                            <div className="text-pink-400 font-mono flex items-center gap-1">
                              <span>🎵</span>
                              <span>{p.tiktok}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Orders */}
                      <td className="px-5 py-4 text-right font-mono font-bold text-fox-text">
                        {p.stats?.orders || 0}
                      </td>

                      {/* Total Sales */}
                      <td className="px-5 py-4 text-right font-mono font-bold text-emerald-400">
                        ${(p.stats?.totalSales || 0).toFixed(2)}
                      </td>

                      {/* Total Commission */}
                      <td className="px-5 py-4 text-right font-mono font-bold text-pink-400">
                        ${(p.stats?.totalCommission || 0).toFixed(2)}
                      </td>

                      {/* Available Balance */}
                      <td className="px-5 py-4 text-right font-mono font-bold text-amber-300">
                        ${(p.stats?.availableBalance || 0).toFixed(2)}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                            p.status === "ACTIVE"
                              ? "bg-green-500/10 text-green-400 border-green-500/30"
                              : "bg-red-500/10 text-red-400 border-red-500/30"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleToggleStatus(p)}
                            disabled={updatingId === p.id}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                              p.status === "ACTIVE"
                                ? "border-red-500/40 text-red-400 hover:bg-red-500/10"
                                : "border-green-500/40 text-green-400 hover:bg-green-500/10"
                            } disabled:opacity-50`}
                          >
                            {updatingId === p.id
                              ? "Saving..."
                              : p.status === "ACTIVE"
                              ? "Suspend"
                              : "Activate"}
                          </button>

                          <Link
                            href={`/admin/promoters/${p.id}`}
                            className="btn-ghost text-xs px-2.5 py-1 text-purple-300 hover:text-white"
                          >
                            Details →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
