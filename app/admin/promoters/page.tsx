"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Affiliate, AffiliateStats, AffiliateSettings, PayoutMethod } from "@/lib/affiliate/types";

interface PromoterWithStats extends Affiliate {
  stats: AffiliateStats;
}

export default function AdminPromotersPage() {
  const [promoters, setPromoters] = useState<PromoterWithStats[]>([]);
  const [settings, setSettings] = useState<AffiliateSettings>({
    registrationOpen: true,
    maxPromoters: 100,
    updatedAt: "",
  });
  const [targetMaxPromoters, setTargetMaxPromoters] = useState<number>(100);
  const [savingSettings, setSavingSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // ── Clear Balance Modal State ─────────────────────────────
  const [clearTarget, setClearTarget] = useState<PromoterWithStats | null>(null);
  const [clearAmount, setClearAmount] = useState("");
  const [clearMethod, setClearMethod] = useState<PayoutMethod>("ABA");
  const [clearAccountName, setClearAccountName] = useState("");
  const [clearAccountNumber, setClearAccountNumber] = useState("");
  const [clearNote, setClearNote] = useState("");
  const [clearing, setClearing] = useState(false);

  // ── Adjust Balance Modal State ────────────────────────────
  const [adjustTarget, setAdjustTarget] = useState<PromoterWithStats | null>(null);
  const [adjustType, setAdjustType] = useState<"ADD" | "DEDUCT">("ADD");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  function openClearModal(p: PromoterWithStats) {
    setClearTarget(p);
    const bal = p.stats?.availableBalance || 0;
    setClearAmount(bal > 0 ? bal.toFixed(2) : "0.00");
    setClearMethod("ABA");
    setClearAccountName(p.name || p.slug);
    setClearAccountNumber(p.phone || "");
    setClearNote(`ទូទាត់ប្រាក់កម្រៃជើងសារជូន ${p.name || p.slug}`);
  }

  async function handleConfirmClear(e: React.FormEvent) {
    e.preventDefault();
    if (!clearTarget) return;

    const amt = parseFloat(clearAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("សូមបញ្ចូលចំនួនទឹកប្រាក់ដែលត្រូវ Clear ឱ្យបានត្រឹមត្រូវ (> 0)");
      return;
    }

    if (amt > (clearTarget.stats?.availableBalance || 0)) {
      alert(`ចំនួនទឹកប្រាក់ $${amt.toFixed(2)} លើសពីសមតុល្យដែលមាន ($${(clearTarget.stats?.availableBalance || 0).toFixed(2)})`);
      return;
    }

    setClearing(true);
    try {
      const res = await fetch("/api/admin/promoters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_balance",
          affiliateId: clearTarget.id,
          amountUsd: amt,
          paymentMethod: clearMethod,
          accountName: clearAccountName,
          accountNumber: clearAccountNumber,
          note: clearNote,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setToast(`បាន Clear លុយ $${amt.toFixed(2)} ជូន ${clearTarget.name || clearTarget.slug} រួចរាល់!`);
        setTimeout(() => setToast(null), 3500);
        setClearTarget(null);
        await load();
      } else {
        alert(data.error || "Failed to clear balance");
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setClearing(false);
    }
  }

  function openAdjustModal(p: PromoterWithStats) {
    setAdjustTarget(p);
    setAdjustType("ADD");
    setAdjustAmount("");
    setAdjustReason("");
  }

  async function handleConfirmAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustTarget) return;

    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("សូមបញ្ចូលចំនួនទឹកប្រាក់ដែលត្រូវកែសម្រួលឱ្យបានត្រឹមត្រូវ (> 0)");
      return;
    }

    if (!adjustReason.trim()) {
      alert("សូមបញ្ចូលមូលហេតុនៃការដក ឬ បន្ថែមលុយនេះ (Reason is required)");
      return;
    }

    if (adjustType === "DEDUCT" && amt > (adjustTarget.stats?.availableBalance || 0)) {
      alert(`មិនអាចដក $${amt.toFixed(2)} បានទេ ពីព្រោះសមតុល្យបច្ចុប្បន្នមានត្រឹមតែ $${(adjustTarget.stats?.availableBalance || 0).toFixed(2)}`);
      return;
    }

    setAdjusting(true);
    try {
      const res = await fetch("/api/admin/promoters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust_balance",
          affiliateId: adjustTarget.id,
          type: adjustType,
          amountUsd: amt,
          reason: adjustReason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setToast(
          adjustType === "ADD"
            ? `បានបន្ថែមលុយ +$${amt.toFixed(2)} ទៅកាន់ ${adjustTarget.name || adjustTarget.slug} ជោគជ័យ!`
            : `បានដកលុយ -$${amt.toFixed(2)} ពី ${adjustTarget.name || adjustTarget.slug} ជោគជ័យ!`
        );
        setTimeout(() => setToast(null), 3500);
        setAdjustTarget(null);
        await load();
      } else {
        alert(data.error || "Failed to adjust balance");
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setAdjusting(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promoters");
      if (res.ok) {
        const data = await res.json();
        setPromoters(data.promoters || []);
        if (data.settings) {
          setSettings(data.settings);
          setTargetMaxPromoters(data.settings.maxPromoters ?? 100);
        }
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

  async function handleSaveSettings(newOpen?: boolean, newMax?: number) {
    setSavingSettings(true);
    const openVal = typeof newOpen === "boolean" ? newOpen : settings.registrationOpen;
    const maxVal = typeof newMax === "number" ? newMax : targetMaxPromoters;

    try {
      const res = await fetch("/api/admin/promoters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_settings",
          registrationOpen: openVal,
          maxPromoters: maxVal,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
          setTargetMaxPromoters(data.settings.maxPromoters);
        }
        setToast(
          openVal
            ? `Registration is now OPEN (Quota: ${maxVal} promoters)`
            : `Registration is now CLOSED (Quota: ${maxVal} promoters)`
        );
        setTimeout(() => setToast(null), 3500);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to update registration settings");
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  }

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
      {/* Header with official transparent logo */}
      <div className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-r from-purple-950/50 via-fox-surface/90 to-pink-950/40 p-6 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 rounded-2xl bg-black/40 border border-white/10 p-2 shadow-inner flex items-center justify-center shrink-0">
              <Image
                src="/theziessstore-logo-transparent.png"
                alt="Theziess Store Logo"
                width={52}
                height={52}
                className="object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]"
              />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Promoters & Content Creators
                </h1>
                <span className="rounded-full border border-purple-400/40 bg-purple-500/20 px-3 py-0.5 text-xs font-bold text-purple-200 font-mono shadow-sm">
                  $0.04 / Order
                </span>
              </div>
              <p className="text-fox-muted text-xs sm:text-sm mt-1">
                Manage creator referral storefronts, sales attribution, and automated commission payouts.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => load()}
              disabled={loading}
              className="btn-ghost text-xs px-3.5 py-2.5 flex items-center gap-2 rounded-xl border border-white/10 hover:border-purple-500/40 hover:bg-purple-500/10 transition-all"
            >
              <span className={loading ? "animate-spin" : ""}>🔄</span>
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm font-semibold text-green-300 flex items-center justify-between">
          <span>✅ {toast}</span>
          <button onClick={() => setToast(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Registration Settings & Quota Card */}
      <div className="rounded-3xl border border-purple-500/25 bg-gradient-to-r from-purple-950/50 via-fox-surface/85 to-indigo-950/40 p-6 shadow-xl backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xl">⚙️</span>
              <h2 className="text-lg font-bold text-white font-display">Promoter Registration & Quota</h2>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                  settings.registrationOpen && promoters.length < settings.maxPromoters
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                    : "bg-red-500/20 text-red-300 border-red-400/30"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    settings.registrationOpen && promoters.length < settings.maxPromoters
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-red-400"
                  }`}
                />
                {settings.registrationOpen && promoters.length < settings.maxPromoters
                  ? "Registration Open"
                  : !settings.registrationOpen
                  ? "Registration Closed"
                  : "Quota Full"}
              </span>
            </div>
            <p className="text-xs text-fox-muted">
              Turn public registration on or off and set the maximum number of promoters allowed to register.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Open / Close Toggle Button */}
            <button
              type="button"
              onClick={() => handleSaveSettings(!settings.registrationOpen)}
              disabled={savingSettings}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 border transition-all shadow-md active:scale-95 ${
                settings.registrationOpen
                  ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-400/40"
                  : "bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-400/40"
              }`}
            >
              <span>{settings.registrationOpen ? "🟢" : "🔴"}</span>
              <span>{settings.registrationOpen ? "Close Registration" : "Open Registration"}</span>
            </button>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-purple-500/20 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Quota Setting Form */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider">
              Maximum Promoter Registration Limit
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-[180px]">
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={targetMaxPromoters}
                  onChange={(e) => setTargetMaxPromoters(Math.max(1, parseInt(e.target.value) || 1))}
                  className="input text-sm font-mono font-bold w-full bg-purple-950/60 border-purple-400/30 text-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fox-muted font-bold">
                  Slots
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleSaveSettings(settings.registrationOpen, targetMaxPromoters)}
                disabled={savingSettings || targetMaxPromoters === settings.maxPromoters}
                className="btn-primary text-xs px-4 py-2.5 rounded-xl disabled:opacity-40"
              >
                {savingSettings ? "Saving..." : "Save Limit"}
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-fox-muted mr-1">Presets:</span>
              {[50, 100, 200, 500, 1000].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setTargetMaxPromoters(num);
                    handleSaveSettings(settings.registrationOpen, num);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border transition-all ${
                    settings.maxPromoters === num
                      ? "bg-pink-500/25 border-pink-400/50 text-pink-300"
                      : "bg-purple-950/40 border-purple-800/40 text-purple-300/80 hover:text-white"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Progress / Capacity Bar */}
          <div className="rounded-2xl bg-black/30 border border-white/10 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-fox-muted font-medium">Capacity Used</span>
              <span className="font-mono font-bold text-white">
                {promoters.length} / {settings.maxPromoters} ({Math.min(100, Math.round((promoters.length / Math.max(1, settings.maxPromoters)) * 100))}%)
              </span>
            </div>
            <div className="w-full bg-purple-950/80 h-3 rounded-full overflow-hidden border border-purple-800/40">
              <div
                style={{
                  width: `${Math.min(100, Math.round((promoters.length / Math.max(1, settings.maxPromoters)) * 100))}%`,
                }}
                className={`h-full rounded-full transition-all duration-500 ${
                  promoters.length >= settings.maxPromoters
                    ? "bg-gradient-to-r from-red-500 to-rose-600"
                    : promoters.length / settings.maxPromoters >= 0.8
                    ? "bg-gradient-to-r from-amber-500 to-orange-500"
                    : "bg-gradient-to-r from-purple-500 via-pink-500 to-emerald-400"
                }`}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-fox-muted">
              <span>Remaining slots: <strong className="text-emerald-300 font-mono">{Math.max(0, settings.maxPromoters - promoters.length)}</strong></span>
              <Link
                href="/promote/register"
                target="_blank"
                className="text-pink-400 hover:text-pink-300 font-semibold flex items-center gap-1"
              >
                <span>Preview Register Page</span>
                <span>↗</span>
              </Link>
            </div>
          </div>
        </div>
      </div>


      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-fox-surface/80 border border-purple-500/20 p-5 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="text-xs text-purple-300/80 uppercase tracking-wider font-semibold">Total Promoters</div>
          <div className="text-3xl font-black font-display text-white mt-1.5">{promoters.length}</div>
          <div className="text-xs text-emerald-400 font-semibold mt-1 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{activeCount} active storefronts</span>
          </div>
        </div>

        <div className="rounded-2xl bg-fox-surface/80 border border-purple-500/20 p-5 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="text-xs text-purple-300/80 uppercase tracking-wider font-semibold">Orders Driven</div>
          <div className="text-3xl font-black font-display text-purple-300 mt-1.5">
            {promoters.reduce((acc, p) => acc + (p.stats?.orders || 0), 0)}
          </div>
          <div className="text-xs text-purple-300/60 mt-1">Across all creators</div>
        </div>

        <div className="rounded-2xl bg-fox-surface/80 border border-purple-500/20 p-5 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-purple-500/40 transition-all">
          <div className="text-xs text-emerald-300/80 uppercase tracking-wider font-semibold">Sales Driven</div>
          <div className="text-3xl font-black font-display text-emerald-400 font-mono mt-1.5">
            ${totalSales.toFixed(2)}
          </div>
          <div className="text-xs text-emerald-400/60 mt-1">Gross merchandise volume</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-pink-950/40 to-purple-950/60 border border-pink-500/30 p-5 shadow-lg backdrop-blur-md relative overflow-hidden group hover:border-pink-500/50 transition-all">
          <div className="text-xs text-pink-300/80 uppercase tracking-wider font-semibold">Total Commission</div>
          <div className="text-3xl font-black font-display text-pink-300 font-mono mt-1.5">
            ${totalCommission.toFixed(2)}
          </div>
          <div className="text-xs text-pink-300/80 mt-1 font-semibold flex items-center gap-1">
            <span>✨</span>
            <span>Fixed $0.04 per order</span>
          </div>
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
                <th className="text-right px-5 py-3">Commission ($0.04/order)</th>
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
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/admin/promoters/${p.id}`}
                                className="font-bold text-fox-text hover:text-fox-primary transition-colors text-sm truncate block"
                              >
                                {promoterName}
                              </Link>
                              <span className="text-[10px] text-purple-400 font-mono">@{p.username || p.slug}</span>
                            </div>
                            <div className="text-xs text-fox-muted truncate font-mono">{p.email}</div>
                            {p.createdAt && (
                              <div className="text-[10px] text-fox-muted/70 mt-0.5">
                                Joined {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </div>
                            )}
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
                          {p.youtube && (
                            <div className="text-red-400 font-mono flex items-center gap-1">
                              <span>▶️</span>
                              <span>{p.youtube}</span>
                            </div>
                          )}
                          {p.facebook && (
                            <div className="text-blue-400 font-mono flex items-center gap-1">
                              <span>📘</span>
                              <span>{p.facebook}</span>
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
                        <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                          {/* Clear Balance Button */}
                          <button
                            type="button"
                            onClick={() => openClearModal(p)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/25 transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                            title="Clear balance (ទូទាត់ប្រាក់ជូន Promoter)"
                          >
                            <span>⚡</span>
                            <span>Clear</span>
                          </button>

                          {/* Adjust Balance (+ / -) Button */}
                          <button
                            type="button"
                            onClick={() => openAdjustModal(p)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold border border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/25 transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                            title="Add or Deduct money (ដក ឬ បន្ថែមលុយ)"
                          >
                            <span>⚖️</span>
                            <span>+/-</span>
                          </button>

                          {/* Suspend / Activate Button */}
                          <button
                            onClick={() => handleToggleStatus(p)}
                            disabled={updatingId === p.id}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
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

      {/* ── Clear Balance Modal ─────────────────────────────────────── */}
      {clearTarget && (
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
                    Clear Balance សម្រាប់ <strong className="text-purple-300">{clearTarget.name || clearTarget.slug}</strong> (@{clearTarget.slug})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClearTarget(null)}
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
                    ${(clearTarget.stats?.availableBalance || 0).toFixed(2)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setClearAmount((clearTarget.stats?.availableBalance || 0).toFixed(2))}
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
                  max={(clearTarget.stats?.availableBalance || 0).toFixed(2)}
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
                  onClick={() => setClearTarget(null)}
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
      {adjustTarget && (
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
                    កែសម្រួលសមតុល្យសម្រាប់ <strong className="text-purple-300">{adjustTarget.name || adjustTarget.slug}</strong> (@{adjustTarget.slug})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
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
                    ${(adjustTarget.stats?.availableBalance || 0).toFixed(2)}
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
                      (adjustTarget.stats?.availableBalance || 0) +
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
                  onClick={() => setAdjustTarget(null)}
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
