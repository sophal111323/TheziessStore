"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Tag,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Gamepad2,
  Package,
  CheckSquare,
  Square,
  Loader2,
  History,
  Search,
  RefreshCw,
  ExternalLink,
  UserCheck,
  Calendar,
  DollarSign,
} from "lucide-react";

interface GameOption {
  id: string;
  name: string;
  slug: string;
}

interface PackageOption {
  id: string;
  name: string;
  priceUsd: number;
  badge?: string | null;
  isRandomSpin?: boolean;
}

interface PromoCode {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minOrderUsd: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
  gameId: string | null;
  game?: { id: string; name: string; slug: string } | null;
  allowedPackageIds: string;
  createdAt: string;
  _count?: {
    orders: number;
    usages: number;
  };
}

interface CouponUsageRecord {
  id: string;
  promoCodeId: string;
  userIdentifier: string;
  orderId: string | null;
  status: string;
  discountUsd: number;
  usedAt: string | null;
  createdAt: string;
  promoCode: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    game?: { id: string; name: string } | null;
  };
  order?: {
    id: string;
    orderNumber: string;
    status: string;
    totalUsd: number;
    product?: { name: string } | null;
  } | null;
}

export default function AdminPromoCodesPage() {
  const [activeTab, setActiveTab] = useState<"codes" | "history">("codes");

  // Promo Codes State
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Available games & packages
  const [games, setGames] = useState<GameOption[]>([]);
  const [gamePackages, setGamePackages] = useState<PackageOption[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  // Create form state
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderUsd, setMinOrderUsd] = useState("0");
  const [maxUses, setMaxUses] = useState("0");
  const [expiresAt, setExpiresAt] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");
  const [packageRestrictionMode, setPackageRestrictionMode] = useState<"ALL" | "CUSTOM">("ALL");
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // History State
  const [historyRecords, setHistoryRecords] = useState<CouponUsageRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilterCodeId, setHistoryFilterCodeId] = useState<string>("");

  async function loadCodes() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promo-codes");
      const data = await res.json();
      if (Array.isArray(data)) setCodes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadGames() {
    try {
      const res = await fetch("/api/admin/games");
      const data = await res.json();
      if (Array.isArray(data)) {
        setGames(data.map((g: any) => ({ id: g.id, name: g.name, slug: g.slug })));
      }
    } catch (err) {
      console.error("Failed to load games:", err);
    }
  }

  async function loadHistory(codeId?: string, search?: string) {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      const cId = codeId !== undefined ? codeId : historyFilterCodeId;
      const q = search !== undefined ? search : historySearch;
      if (cId) params.set("codeId", cId);
      if (q) params.set("search", q);

      const res = await fetch(`/api/admin/promo-codes/history?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistoryRecords(data);
      }
    } catch (err) {
      console.error("Failed to load promo history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadCodes();
    loadGames();
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab]);

  // When selectedGameId changes, fetch that game's packages
  useEffect(() => {
    if (!selectedGameId) {
      setGamePackages([]);
      setSelectedPackageIds([]);
      setPackageRestrictionMode("ALL");
      return;
    }

    let isCancelled = false;
    setLoadingPackages(true);

    Promise.all([
      fetch(`/api/admin/products?gameId=${selectedGameId}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/admin/random-packages?gameId=${selectedGameId}`).then((r) => r.json()).catch(() => []),
    ])
      .then(([products, randomPkgs]) => {
        if (isCancelled) return;
        const list: PackageOption[] = [];
        if (Array.isArray(products)) {
          for (const p of products) {
            list.push({
              id: p.id,
              name: p.name,
              priceUsd: p.priceUsd,
              badge: p.badge,
              isRandomSpin: false,
            });
          }
        }
        if (Array.isArray(randomPkgs)) {
          for (const rp of randomPkgs) {
            list.push({
              id: rp.id,
              name: `${rp.name} (Mystery Box)`,
              priceUsd: rp.priceUsd,
              badge: rp.badge || "🎰 Mystery Box",
              isRandomSpin: true,
            });
          }
        }
        setGamePackages(list);
      })
      .finally(() => {
        if (!isCancelled) setLoadingPackages(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedGameId]);

  function togglePackageSelection(pkgId: string) {
    setSelectedPackageIds((prev) =>
      prev.includes(pkgId) ? prev.filter((id) => id !== pkgId) : [...prev, pkgId]
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (selectedGameId && packageRestrictionMode === "CUSTOM" && selectedPackageIds.length === 0) {
      setFormError("សូមជ្រើសរើសកញ្ចប់យ៉ាងហោចណាស់ 1 (Please select at least 1 package)");
      return;
    }

    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          discountType,
          discountValue: parseFloat(discountValue),
          minOrderUsd: parseFloat(minOrderUsd) || 0,
          maxUses: parseInt(maxUses) || 0,
          expiresAt: expiresAt || null,
          gameId: selectedGameId || null,
          allowedPackageIds:
            selectedGameId && packageRestrictionMode === "CUSTOM" ? selectedPackageIds : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");

      setCreating(false);
      setCode("");
      setDiscountValue("");
      setMinOrderUsd("0");
      setMaxUses("0");
      setExpiresAt("");
      setSelectedGameId("");
      setPackageRestrictionMode("ALL");
      setSelectedPackageIds([]);
      loadCodes();
    } catch (err: any) {
      setFormError(err.message);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/admin/promo-codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    loadCodes();
  }

  async function deleteCode(id: string) {
    if (!confirm("Delete this promo code?")) return;
    await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
    loadCodes();
  }

  function parseAllowedPackages(allowedPackageIdsJson: string): string[] {
    try {
      const arr = JSON.parse(allowedPackageIdsJson);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function openHistoryForCode(codeId: string) {
    setHistoryFilterCodeId(codeId);
    setActiveTab("history");
    loadHistory(codeId, historySearch);
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Tag className="h-6 w-6 text-fox-primary" />
            Promo Codes & Claim History
          </h1>
          <p className="text-fox-muted text-sm">
            គ្រប់គ្រងកូដបញ្ចុះតម្លៃ កំណត់ហ្គេម & កញ្ចប់ និងមើលប្រវត្តិ Player ID ដែលបាន Claim
          </p>
        </div>

        {activeTab === "codes" && (
          <button
            onClick={() => setCreating(!creating)}
            className="btn-primary text-sm flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            បង្កើតកូដថ្មី (New Code)
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-fox-border">
        <button
          onClick={() => setActiveTab("codes")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "codes"
              ? "border-fox-primary text-fox-primary"
              : "border-transparent text-fox-muted hover:text-fox-text"
          }`}
        >
          <Tag className="h-4 w-4" />
          បញ្ជីកូដបញ្ចុះតម្លៃ ({codes.length})
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "history"
              ? "border-fox-primary text-fox-primary"
              : "border-transparent text-fox-muted hover:text-fox-text"
          }`}
        >
          <History className="h-4 w-4" />
          ប្រវត្តិ Claim & ID អ្នកប្រើប្រាស់
        </button>
      </div>

      {/* TAB 1: CODES MANAGEMENT */}
      {activeTab === "codes" && (
        <div className="space-y-6">
          {/* Create form */}
          {creating && (
            <form onSubmit={handleCreate} className="card p-5 space-y-4">
              <h2 className="font-display text-base font-bold text-fox-primary">
                បង្កើតកូដបញ្ចុះតម្លៃថ្មី (Create New Code)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Code (លេខកូដ)</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="input font-mono uppercase"
                    placeholder="PROMO2026"
                    required
                  />
                </div>

                <div>
                  <label className="label">Discount Type (ប្រភេទបញ្ចុះតម្លៃ)</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="input"
                  >
                    <option value="PERCENT">Percentage (%) — គិតជាភាគរយ</option>
                    <option value="FIXED">Fixed Amount ($) — គិតជាចំនួនប្រាក់</option>
                  </select>
                </div>

                <div>
                  <label className="label">
                    Discount Value {discountType === "PERCENT" ? "(%)" : "($)"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="input"
                    placeholder={discountType === "PERCENT" ? "10" : "0.50"}
                    required
                  />
                </div>

                <div>
                  <label className="label">Min. Order ($) (កុម្ម៉ង់អប្បបរមា)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={minOrderUsd}
                    onChange={(e) => setMinOrderUsd(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Max Uses (0 = unlimited / មិនកំណត់)</label>
                  <input
                    type="number"
                    min="0"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Expires At (ថ្ងៃផុតកំណត់ - ទុកទំនេរបាន)</label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="input"
                  />
                </div>

                {/* Game Restriction */}
                <div className="sm:col-span-2">
                  <label className="label flex items-center gap-1.5">
                    <Gamepad2 className="h-4 w-4 text-purple-400" />
                    <span>កំណត់សម្រាប់ហ្គេម (Game Restriction)</span>
                  </label>
                  <select
                    value={selectedGameId}
                    onChange={(e) => setSelectedGameId(e.target.value)}
                    className="input"
                  >
                    <option value="">🌐 គ្រប់ហ្គេមទាំងអស់ (All Games - No Restriction)</option>
                    {games.map((g) => (
                      <option key={g.id} value={g.id}>
                        🎮 {g.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-fox-muted mt-1">
                    ប្រសិនបើរើសហ្គេមជាក់លាក់ កូដនេះនឹងដំណើរការបានតែក្នុងហ្គេមនោះប៉ុណ្ណោះ។
                  </p>
                </div>

                {/* Package Restriction (Visible only when a specific game is selected) */}
                {selectedGameId && (
                  <div className="sm:col-span-2 p-4 rounded-xl bg-fox-surface border border-fox-border space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="label flex items-center gap-1.5 mb-0">
                        <Package className="h-4 w-4 text-pink-400" />
                        <span className="font-semibold text-fox-text">
                          កំណត់សម្រាប់កញ្ចប់ (Package Restriction)
                        </span>
                      </label>
                      {loadingPackages && (
                        <div className="flex items-center gap-1.5 text-xs text-fox-muted">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>កំពុងទាញយកកញ្ចប់...</span>
                        </div>
                      )}
                    </div>

                    {/* Mode Radio */}
                    <div className="flex items-center gap-4 text-sm">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="packageMode"
                          checked={packageRestrictionMode === "ALL"}
                          onChange={() => {
                            setPackageRestrictionMode("ALL");
                            setSelectedPackageIds([]);
                          }}
                          className="accent-fox-primary"
                        />
                        <span>គ្រប់កញ្ចប់ទាំងអស់ក្នុងហ្គេមនេះ (All Packages)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="packageMode"
                          checked={packageRestrictionMode === "CUSTOM"}
                          onChange={() => setPackageRestrictionMode("CUSTOM")}
                          className="accent-fox-primary"
                        />
                        <span>កញ្ចប់ជាក់លាក់ (Specific Packages Only)</span>
                      </label>
                    </div>

                    {/* Checkbox list when CUSTOM is selected */}
                    {packageRestrictionMode === "CUSTOM" && (
                      <div className="space-y-2 mt-2 pt-2 border-t border-fox-border/60">
                        <div className="flex items-center justify-between text-xs text-fox-muted">
                          <span>
                            បានជ្រើសរើស: <strong>{selectedPackageIds.length}</strong> កញ្ចប់
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedPackageIds(gamePackages.map((p) => p.id))}
                              className="text-fox-primary hover:underline"
                            >
                              ជ្រើសទាំងអស់
                            </button>
                            <span>|</span>
                            <button
                              type="button"
                              onClick={() => setSelectedPackageIds([])}
                              className="text-fox-muted hover:underline"
                            >
                              ដោះទាំងអស់
                            </button>
                          </div>
                        </div>

                        {gamePackages.length === 0 && !loadingPackages ? (
                          <div className="text-xs text-fox-muted py-3 text-center">
                            មិនមានកញ្ចប់នៅក្នុងហ្គេមនេះនៅឡើយទេ
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
                            {gamePackages.map((pkg) => {
                              const isChecked = selectedPackageIds.includes(pkg.id);
                              return (
                                <button
                                  key={pkg.id}
                                  type="button"
                                  onClick={() => togglePackageSelection(pkg.id)}
                                  className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all ${
                                    isChecked
                                      ? "bg-fox-primary/10 border-fox-primary/40 text-fox-text"
                                      : "bg-fox-bg/50 border-fox-border/50 text-fox-muted hover:border-fox-border"
                                  }`}
                                >
                                  {isChecked ? (
                                    <CheckSquare className="h-4 w-4 text-fox-primary mt-0.5 shrink-0" />
                                  ) : (
                                    <Square className="h-4 w-4 text-fox-muted mt-0.5 shrink-0" />
                                  )}
                                  <div className="text-xs min-w-0">
                                    <div className="font-semibold text-fox-text truncate">
                                      {pkg.name}
                                    </div>
                                    <div className="text-fox-muted">
                                      ${pkg.priceUsd.toFixed(2)}{" "}
                                      {pkg.badge ? `• ${pkg.badge}` : ""}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {formError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="btn-secondary text-sm"
                >
                  បោះបង់ (Cancel)
                </button>
                <button type="submit" className="btn-primary text-sm">
                  រក្សាទុកកូដ (Save Promo Code)
                </button>
              </div>
            </form>
          )}

          {/* Promo Codes Table */}
          {loading ? (
            <div className="card p-8 text-center text-fox-muted flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-fox-primary" />
              <span>Loading promo codes...</span>
            </div>
          ) : codes.length === 0 ? (
            <div className="card p-8 text-center text-fox-muted">
              មិនទាន់មានកូដបញ្ចុះតម្លៃនៅឡើយទេ។ ចុច "បង្កើតកូដថ្មី" ដើម្បីបង្កើត។
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-fox-muted text-xs border-b border-fox-border">
                    <th className="py-3 px-3 font-medium">Code</th>
                    <th className="py-3 px-3 font-medium">Discount</th>
                    <th className="py-3 px-3 font-medium">Game</th>
                    <th className="py-3 px-3 font-medium">Allowed Packages</th>
                    <th className="py-3 px-3 font-medium hidden sm:table-cell">Min. Order</th>
                    <th className="py-3 px-3 font-medium">Uses</th>
                    <th className="py-3 px-3 font-medium hidden md:table-cell">Expires</th>
                    <th className="py-3 px-3 font-medium">Status</th>
                    <th className="py-3 px-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => {
                    const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
                    const maxedOut = c.maxUses > 0 && c.usedCount >= c.maxUses;
                    const allowedPkgs = parseAllowedPackages(c.allowedPackageIds);

                    return (
                      <tr key={c.id} className="border-b border-fox-border/50 hover:bg-fox-surface/50">
                        <td className="py-3 px-3 font-mono font-bold text-fox-primary">{c.code}</td>
                        <td className="py-3 px-3 font-medium">
                          {c.discountType === "PERCENT"
                            ? `${c.discountValue}%`
                            : `$${c.discountValue.toFixed(2)}`}
                        </td>
                        <td className="py-3 px-3">
                          {c.game ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                              🎮 {c.game.name}
                            </span>
                          ) : (
                            <span className="text-xs text-fox-muted">🌐 All Games</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {allowedPkgs.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-500/15 text-pink-300 border border-pink-500/30">
                              📦 {allowedPkgs.length} កញ្ចប់
                            </span>
                          ) : (
                            <span className="text-xs text-fox-muted">All Packages</span>
                          )}
                        </td>
                        <td className="py-3 px-3 hidden sm:table-cell">
                          {c.minOrderUsd > 0 ? `$${c.minOrderUsd.toFixed(2)}` : "—"}
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {c.usedCount}
                          {c.maxUses > 0 ? `/${c.maxUses}` : "/∞"}
                        </td>
                        <td className="py-3 px-3 hidden md:table-cell text-xs">
                          {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}
                          {expired && <span className="text-red-400 ml-1">(expired)</span>}
                        </td>
                        <td className="py-3 px-3">
                          {!c.active || expired || maxedOut ? (
                            <span className="text-xs text-red-400 font-medium">
                              {expired ? "Expired" : maxedOut ? "Maxed" : "Disabled"}
                            </span>
                          ) : (
                            <span className="text-xs text-green-400 font-medium">Active</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View History button */}
                            <button
                              onClick={() => openHistoryForCode(c.id)}
                              className="p-1.5 rounded-lg hover:bg-fox-surface transition-colors text-fox-muted hover:text-fox-primary"
                              title="មើលប្រវត្តិ Claim កូដនេះ"
                            >
                              <History className="h-4 w-4" />
                            </button>

                            {/* Toggle Active */}
                            <button
                              onClick={() => toggleActive(c.id, c.active)}
                              className="p-1.5 rounded-lg hover:bg-fox-surface transition-colors text-fox-muted hover:text-fox-text"
                              title={c.active ? "Disable" : "Enable"}
                            >
                              {c.active ? (
                                <ToggleRight className="h-4 w-4 text-green-400" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => deleteCode(c.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-fox-muted hover:text-red-400"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CLAIM & USAGE HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="card p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fox-muted" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadHistory();
                  }}
                  placeholder="ស្វែងរកតាម Player ID, Code ឬ Order #..."
                  className="input pl-9 text-xs sm:text-sm w-full"
                />
              </div>

              {/* Filter by Promo Code dropdown */}
              <select
                value={historyFilterCodeId}
                onChange={(e) => {
                  setHistoryFilterCodeId(e.target.value);
                  loadHistory(e.target.value);
                }}
                className="input text-xs sm:text-sm w-full sm:w-auto"
              >
                <option value="">គ្រប់កូដទាំងអស់ (All Promo Codes)</option>
                {codes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} ({c.discountType === "PERCENT" ? `${c.discountValue}%` : `$${c.discountValue}`})
                  </option>
                ))}
              </select>

              <button
                onClick={() => loadHistory()}
                className="btn-primary text-xs sm:text-sm flex items-center justify-center gap-1.5 px-3 py-2"
                title="ស្វែងរក"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search</span>
              </button>
            </div>

            <button
              onClick={() => {
                setHistorySearch("");
                setHistoryFilterCodeId("");
                loadHistory("", "");
              }}
              className="btn-secondary text-xs sm:text-sm flex items-center justify-center gap-1.5 px-3 py-2"
              title="Reset Filters"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* History Table */}
          {loadingHistory ? (
            <div className="card p-12 text-center text-fox-muted flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-fox-primary" />
              <span>កំពុងទាញយកប្រវត្តិ Claim...</span>
            </div>
          ) : historyRecords.length === 0 ? (
            <div className="card p-12 text-center text-fox-muted space-y-2">
              <History className="h-8 w-8 mx-auto text-fox-muted/60" />
              <div className="text-base font-semibold text-fox-text">មិនទាន់មានប្រវត្តិ Claim នៅឡើយទេ</div>
              <p className="text-xs text-fox-muted">
                នៅពេល User ចុច "អនុវត្ត" (Apply) នៅលើគេហទំព័រ Player ID នឹងត្រូវបានកត់ត្រានៅទីនេះភ្លាមៗ។
              </p>
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <div className="p-3 text-xs text-fox-muted border-b border-fox-border flex items-center justify-between">
                <span>
                  បានរកឃើញ: <strong>{historyRecords.length}</strong> កំណត់ត្រា
                </span>
                {historyFilterCodeId && (
                  <span className="text-fox-primary">
                    តម្រងតាមកូដ:{" "}
                    <strong>{codes.find((c) => c.id === historyFilterCodeId)?.code}</strong>
                  </span>
                )}
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-fox-muted text-xs border-b border-fox-border">
                    <th className="py-3 px-3 font-medium">Player ID / User</th>
                    <th className="py-3 px-3 font-medium">Promo Code</th>
                    <th className="py-3 px-3 font-medium">Discount</th>
                    <th className="py-3 px-3 font-medium">Game</th>
                    <th className="py-3 px-3 font-medium">Order Status</th>
                    <th className="py-3 px-3 font-medium">Claim Date</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRecords.map((item) => {
                    const hasOrder = Boolean(item.order);
                    const orderNum = item.order?.orderNumber;

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-fox-border/50 hover:bg-fox-surface/50"
                      >
                        {/* Player ID */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-fox-text bg-fox-surface px-2 py-0.5 rounded border border-fox-border/60">
                              {item.userIdentifier}
                            </span>
                          </div>
                        </td>

                        {/* Promo Code */}
                        <td className="py-3 px-3">
                          <span className="font-mono font-semibold text-fox-primary">
                            {item.promoCode?.code || "—"}
                          </span>
                        </td>

                        {/* Discount */}
                        <td className="py-3 px-3 font-medium text-emerald-400">
                          {item.discountUsd > 0
                            ? `-$${item.discountUsd.toFixed(2)}`
                            : item.promoCode?.discountType === "PERCENT"
                            ? `${item.promoCode.discountValue}%`
                            : `$${item.promoCode?.discountValue || 0}`}
                        </td>

                        {/* Game */}
                        <td className="py-3 px-3">
                          {item.promoCode?.game?.name ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                              {item.promoCode.game.name}
                            </span>
                          ) : (
                            <span className="text-xs text-fox-muted">All Games</span>
                          )}
                        </td>

                        {/* Order Status */}
                        <td className="py-3 px-3">
                          {hasOrder && orderNum ? (
                            <Link
                              href={`/admin/orders/${orderNum}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 underline"
                              title="មើល Order លម្អិត"
                            >
                              <span>#{orderNum}</span>
                              <ExternalLink className="h-3 w-3" />
                              <span
                                className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  item.order?.status === "COMPLETED"
                                    ? "bg-green-500/20 text-green-300"
                                    : item.order?.status === "PENDING"
                                    ? "bg-yellow-500/20 text-yellow-300"
                                    : "bg-red-500/20 text-red-300"
                                }`}
                              >
                                {item.order?.status}
                              </span>
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <span>Claimed (មិនទាន់ Order)</span>
                            </span>
                          )}
                        </td>

                        {/* Claim Date */}
                        <td className="py-3 px-3 text-xs text-fox-muted">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleString("en-GB", {
                                year: "numeric",
                                month: "short",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
