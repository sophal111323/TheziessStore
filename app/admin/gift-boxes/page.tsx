"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Gift,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Edit2,
  RefreshCw,
  Search,
  ExternalLink,
  Loader2,
  Sparkles,
  Save,
  X,
  Sliders,
  History,
  Tag,
  Package,
  Layers,
  Check,
  Zap,
} from "lucide-react";

interface SlotItem {
  id?: string;
  slotNumber: number;
  label: string;
  rewardType: "GAME_PACKAGE" | "PROMO_CODE" | "DIAMOND" | "CUSTOM" | "THANK_YOU";
  rewardValue?: string | null;
  rewardAmount: number;
  productId?: string | null;
  promoCodeId?: string | null;
  supplier?: string;
  supplierCode?: string | null;
  inStock?: boolean;
  probability: number;
  color: string;
  icon: string;
  active: boolean;
  product?: {
    id: string;
    name: string;
    priceUsd: number;
    amount?: number;
    supplier?: string;
    supplierCode?: string | null;
  } | null;
  promoCode?: { id: string; code: string; discountType: string; discountValue: number } | null;
}

interface ClaimRecord {
  id: string;
  orderNumber: string;
  playerUid: string;
  slotNumber: number;
  rewardType: string;
  rewardTitle: string;
  rewardValue?: string | null;
  rewardAmount: number;
  promoCodeStr?: string | null;
  supplier?: string | null;
  supplierCode?: string | null;
  status: string;
  claimedAt: string;
  order?: {
    orderNumber: string;
    amountUsd: number;
    game?: { name: string } | null;
    product?: { name: string } | null;
  } | null;
}

interface ProductOption {
  id: string;
  name: string;
  priceUsd: number;
  amount?: number;
  gameId: string;
  supplier?: string;
  supplierCode?: string | null;
  inStock?: boolean;
}

interface PromoOption {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
}

const PROVIDER_OPTIONS = [
  { id: "bay2game", label: "Bay2Game", icon: "⚡", codePlaceholder: "e.g. 50 (Bay2Game Code)" },
  { id: "khmer_topup", label: "Khmer TopUp", icon: "🇰🇭", codePlaceholder: "e.g. 102 (Package ID)" },
  { id: "frozenyuki", label: "FrozenYuki", icon: "❄️", codePlaceholder: "e.g. ff:100 (Code)" },
  { id: "manual", label: "Manual (បញ្ចូលដៃ)", icon: "👤", codePlaceholder: "Optional Note" },
];

export default function AdminGiftBoxesPage() {
  const [activeTab, setActiveTab] = useState<"slots" | "history">("slots");

  // Event State
  const [eventEnabled, setEventEnabled] = useState(true);
  const [togglingEvent, setTogglingEvent] = useState(false);

  // Slots State
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Options
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoOption[]>([]);

  // Editing Slot Modal State
  const [editingSlot, setEditingSlot] = useState<SlotItem | null>(null);

  // History State
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  // Load Main Data
  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gift-boxes");
      const data = await res.json();
      if (res.ok) {
        setEventEnabled(data.eventEnabled);
        if (Array.isArray(data.slots)) {
          setSlots(data.slots);
        }
      }
    } catch (err) {
      console.error("Failed to load gift slots:", err);
    } finally {
      setLoading(false);
    }
  }

  // Load Products & Promos for selectors
  async function loadSelectors() {
    try {
      const [prodRes, promoRes] = await Promise.all([
        fetch("/api/admin/products").then((r) => r.json()).catch(() => []),
        fetch("/api/admin/promo-codes").then((r) => r.json()).catch(() => []),
      ]);
      if (Array.isArray(prodRes)) setProducts(prodRes);
      if (Array.isArray(promoRes)) setPromoCodes(promoRes);
    } catch (err) {
      console.error(err);
    }
  }

  // Load Claims
  async function loadClaims(search?: string) {
    setLoadingClaims(true);
    try {
      const q = search !== undefined ? search : historySearch;
      const url = q ? `/api/admin/gift-boxes/claims?search=${encodeURIComponent(q)}` : "/api/admin/gift-boxes/claims";
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) setClaims(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClaims(false);
    }
  }

  useEffect(() => {
    loadData();
    loadSelectors();
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      loadClaims();
    }
  }, [activeTab]);

  // Toggle Event Enabled
  async function toggleEvent() {
    setTogglingEvent(true);
    try {
      const res = await fetch("/api/admin/gift-boxes/toggle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !eventEnabled }),
      });
      const data = await res.json();
      if (res.ok) {
        setEventEnabled(data.giftEventEnabled);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingEvent(false);
    }
  }

  // Save Slot Edit directly to state and server
  async function handleSaveSlot(updated: SlotItem) {
    const newSlots = slots.map((s) => (s.slotNumber === updated.slotNumber ? updated : s));
    setSlots(newSlots);
    setEditingSlot(null);

    setSaving(true);
    try {
      const res = await fetch("/api/admin/gift-boxes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: newSlots }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  // Save All Slots to Server
  async function saveAllSlots() {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/admin/gift-boxes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const totalProbability = useMemo(() => {
    return slots
      .filter((s) => s.active)
      .reduce((sum, s) => sum + Number(s.probability || 0), 0);
  }, [slots]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 card p-6 bg-gradient-to-r from-purple-900/30 via-fuchsia-900/20 to-purple-950/40 border-purple-500/30">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Gift className="h-6 w-6" />
            </span>
            <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
              Gift Boxes Event (ចាប់កាដូ 9 ប្រអប់)
            </h1>
          </div>
          <p className="text-sm text-purple-200/80">
            កំណត់រង្វាន់កាដូទាំង 9 (Provider Stock, ID Item) បើក/បិទកម្មវិធី និងពិនិត្យប្រវត្តិអ្នកបានបើកកាដូ
          </p>
        </div>

        {/* Open/Close Event Button */}
        <div className="flex items-center gap-3 self-start sm:self-auto bg-black/40 p-2.5 rounded-2xl border border-purple-500/30 backdrop-blur-md">
          <div className="text-right">
            <div className="text-xs font-semibold text-purple-200">ស្ថានភាពកម្មវិធី (Event Status):</div>
            <div className="flex items-center gap-1.5 justify-end">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${eventEnabled ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
              <span className={`text-xs font-bold ${eventEnabled ? "text-emerald-400" : "text-red-400"}`}>
                {eventEnabled ? "បើកដំណើរការ (Open)" : "បិទ (Closed)"}
              </span>
            </div>
          </div>

          <button
            onClick={toggleEvent}
            disabled={togglingEvent}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md ${
              eventEnabled
                ? "bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30"
                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
            }`}
          >
            {togglingEvent ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : eventEnabled ? (
              <ToggleRight className="h-4 w-4 text-red-400" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-emerald-400" />
            )}
            <span>{eventEnabled ? "បិទកម្មវិធី (Close Event)" : "បើកកម្មវិធី (Open Event)"}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-fox-border pb-2">
        <button
          onClick={() => setActiveTab("slots")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
            activeTab === "slots"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "text-fox-muted hover:text-fox-text hover:bg-fox-surface"
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>រៀបចំកាដូទាំង 9 (9 Gift Boxes)</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
            activeTab === "history"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
              : "text-fox-muted hover:text-fox-text hover:bg-fox-surface"
          }`}
        >
          <History className="h-4 w-4" />
          <span>ប្រវត្តិអ្នកចាប់កាដូ (Claims History)</span>
        </button>
      </div>

      {/* TAB 1: 9 SLOTS SETUP */}
      {activeTab === "slots" && (
        <div className="space-y-6">
          {/* Top action bar */}
          <div className="card p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-purple-950/20 border-purple-500/20">
            <div className="flex items-center gap-3">
              <span className="text-xs text-fox-muted">
                ផលបូកប្រូបាប (Total Probability):{" "}
                <strong className={Math.abs(totalProbability - 100) < 0.1 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                  {totalProbability.toFixed(1)}%
                </strong>
              </span>
              {Math.abs(totalProbability - 100) >= 0.1 && (
                <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  ⚠️ គួរតែកំណត់ឱ្យគ្រប់ 100%
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                disabled={loading}
                className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-2 cursor-pointer"
                title="Reload"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Reload</span>
              </button>

              <button
                onClick={saveAllSlots}
                disabled={saving}
                className="btn-primary text-xs flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 border-0 cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>រក្សាទុកទាំងអស់ (Save All)</span>
              </button>
            </div>
          </div>

          {saveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="h-4 w-4" />
              <span>បានរក្សាទុកព័ត៌មានកាដូទាំង 9 ដោយជោគជ័យ!</span>
            </div>
          )}

          {/* 9 Slots Grid (3x3 on desktop, responsive) */}
          {loading ? (
            <div className="card p-12 text-center text-fox-muted flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
              <span>កំពុងទាញយកព័ត៌មានកាដូ...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {slots.map((slot) => {
                const isPromo = slot.rewardType === "PROMO_CODE";
                const isPackage = slot.rewardType === "GAME_PACKAGE";
                const isDiamond = slot.rewardType === "DIAMOND";
                const isThankYou = slot.rewardType === "THANK_YOU";
                const prov = PROVIDER_OPTIONS.find((p) => p.id === (slot.supplier || "bay2game"));

                return (
                  <div
                    key={slot.slotNumber}
                    className={`card p-4 relative overflow-hidden transition-all border ${
                      slot.active
                        ? "border-purple-500/40 bg-gradient-to-b from-purple-950/25 to-fox-card hover:border-purple-400"
                        : "border-fox-border/40 opacity-60 bg-fox-bg/40"
                    }`}
                  >
                    {/* Top Row: Box Number & Active status */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-purple-500/20 text-purple-300 font-mono font-bold text-xs border border-purple-500/30">
                          #{slot.slotNumber}
                        </span>
                        <span className="text-lg">{slot.icon || "🎁"}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/30">
                          {slot.probability}%
                        </span>
                        <button
                          onClick={() => setEditingSlot(slot)}
                          className="p-1.5 rounded-lg bg-fox-surface hover:bg-purple-500/20 text-fox-muted hover:text-purple-300 transition-colors cursor-pointer"
                          title="កែសម្រួលកាដូនេះ"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Label / Title */}
                    <div className="mb-2">
                      <div className="font-bold text-sm text-fox-text truncate" title={slot.label}>
                        {slot.label}
                      </div>
                    </div>

                    {/* Reward Details */}
                    <div className="space-y-1.5 text-xs text-fox-muted pt-2 border-t border-fox-border/40">
                      <div className="flex items-center justify-between">
                        <span>ប្រភេទ (Type):</span>
                        <span className={`font-semibold ${isThankYou ? "text-pink-400" : "text-purple-300"}`}>
                          {isPackage ? "📦 Game Package" : isPromo ? "🏷️ Promo Code" : isDiamond ? "💎 Diamonds" : isThankYou ? "🙏 សូមអរគុណ (Thank You)" : "✨ Custom"}
                        </span>
                      </div>

                      {isThankYou ? (
                        <div className="flex items-center justify-between pt-1 border-t border-purple-500/10">
                          <span>រង្វាន់:</span>
                          <span className="font-semibold text-pink-300 bg-pink-950/40 px-2 py-0.5 rounded border border-pink-500/20 text-[11px]">
                            🙏 សូមអរគុណ (គ្មានពេជ្រ/កូដ)
                          </span>
                        </div>
                      ) : (
                        <>
                          {/* Provider Stock & ID Item display */}
                          <div className="flex items-center justify-between pt-1 border-t border-purple-500/10">
                            <span>Provider Stock:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[11px] text-purple-300 bg-purple-900/40 border border-purple-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <span>{prov?.icon || "⚡"}</span>
                                <span>{prov?.label || slot.supplier || "Bay2Game"}</span>
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                slot.inStock !== false ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                              }`}>
                                {slot.inStock !== false ? "Stock" : "Out"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span>ID Item:</span>
                            <span className="font-mono font-bold text-[11px] text-yellow-300 bg-black/40 px-2 py-0.5 rounded border border-yellow-500/20 truncate max-w-[140px]">
                              {slot.supplierCode || "— (No Code)"}
                            </span>
                          </div>
                        </>
                      )}

                      {isPackage && (
                        <div className="flex items-center justify-between truncate">
                          <span>កញ្ចប់:</span>
                          <span className="font-semibold text-pink-300 truncate max-w-[150px]">
                            {slot.product?.name || slot.rewardValue || "—"}
                          </span>
                        </div>
                      )}

                      {isPromo && (
                        <div className="flex items-center justify-between">
                          <span>កូដ:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {slot.promoCode?.code || slot.rewardValue || "LUCKY10"}
                          </span>
                        </div>
                      )}

                      {isDiamond && (
                        <div className="flex items-center justify-between">
                          <span>ចំនួនពេជ្រ:</span>
                          <span className="font-bold text-cyan-400">
                            {slot.rewardAmount} 💎
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <span>ស្ថានភាព:</span>
                        <span className={slot.active ? "text-emerald-400 font-bold" : "text-fox-muted"}>
                          {slot.active ? "បើក (Active)" : "បិទ (Disabled)"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="card p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fox-muted" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadClaims()}
                placeholder="ស្វែងរកតាម Order Number ឬ Player UID..."
                className="input pl-9 text-xs"
              />
            </div>

            <button
              onClick={() => loadClaims()}
              disabled={loadingClaims}
              className="btn-primary text-xs flex items-center justify-center gap-1.5 px-4 py-2 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingClaims ? "animate-spin" : ""}`} />
              <span>ស្វែងរក / Refresh</span>
            </button>
          </div>

          {/* Claims Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-fox-surface border-b border-fox-border text-fox-muted">
                  <tr>
                    <th className="p-3.5">Order Number</th>
                    <th className="p-3.5">Player UID</th>
                    <th className="p-3.5">កាដូ #</th>
                    <th className="p-3.5">រង្វាន់ដែលទទួលបាន</th>
                    <th className="p-3.5">Provider / ID Item</th>
                    <th className="p-3.5">កាលបរិច្ឆេទ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-fox-border">
                  {claims.length === 0 && !loadingClaims && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-fox-muted">
                        មិនទាន់មានប្រវត្តិអ្នកបើកកាដូនៅឡើយទេ។
                      </td>
                    </tr>
                  )}

                  {claims.map((c) => (
                    <tr key={c.id} className="hover:bg-fox-surface/40 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-purple-400">
                        <Link href={`/order?number=${c.orderNumber}`} target="_blank" className="hover:underline flex items-center gap-1">
                          <span>{c.orderNumber}</span>
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </Link>
                      </td>
                      <td className="p-3.5 font-mono text-fox-text">
                        {c.playerUid}
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-purple-500/20 text-purple-300 font-bold font-mono">
                          #{c.slotNumber}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-white">{c.rewardTitle}</div>
                        {c.promoCodeStr && (
                          <div className="font-mono text-[10px] text-yellow-300 bg-yellow-400/10 px-1.5 py-0.5 rounded w-max mt-0.5">
                            Promo: {c.promoCodeStr}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-fox-muted">
                        <div>{c.supplier || "bay2game"}</div>
                        {c.supplierCode && (
                          <span className="text-[10px] text-yellow-400 bg-black/30 px-1 rounded">
                            ID: {c.supplierCode}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-fox-muted">
                        {new Date(c.claimedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT SLOT MODAL ── */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-purple-400/40 bg-gradient-to-b from-[#1e0938] via-[#150626] to-[#120520] p-6 shadow-2xl shadow-purple-500/20 animate-scale-in max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-purple-500/20 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                  <Edit2 className="h-4 w-4" />
                </span>
                <h3 className="font-display text-lg font-bold text-white">
                  កែសម្រួលកាដូ #{editingSlot.slotNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingSlot(null)}
                className="text-fox-muted hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              {/* Prize Name / Label */}
              <div>
                <label className="label">ឈ្មោះរង្វាន់ (Label / Prize Name)</label>
                <input
                  type="text"
                  value={editingSlot.label}
                  onChange={(e) => setEditingSlot({ ...editingSlot, label: e.target.value })}
                  className="input font-semibold"
                  placeholder="e.g. 💎 100 Diamonds"
                />
              </div>

              {/* Reward Type & Probability */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">ប្រភេទរង្វាន់ (Reward Type)</label>
                  <select
                    value={editingSlot.rewardType}
                    onChange={(e) => {
                      const t = e.target.value as any;
                      setEditingSlot({
                        ...editingSlot,
                        rewardType: t,
                        label:
                          t === "THANK_YOU" &&
                          (!editingSlot.label ||
                            editingSlot.label.includes("Diamonds") ||
                            editingSlot.label.includes("កូដ") ||
                            editingSlot.label.includes("កញ្ចប់"))
                            ? "🙏 សូមអរគុណ (Thank You)"
                            : editingSlot.label,
                        icon: t === "THANK_YOU" ? "🙏" : editingSlot.icon || "🎁",
                        productId: t === "GAME_PACKAGE" ? editingSlot.productId : null,
                        promoCodeId: t === "PROMO_CODE" ? editingSlot.promoCodeId : null,
                        rewardAmount: t === "THANK_YOU" ? 0 : editingSlot.rewardAmount,
                        supplier: t === "THANK_YOU" ? "manual" : editingSlot.supplier,
                        supplierCode: t === "THANK_YOU" ? null : editingSlot.supplierCode,
                      });
                    }}
                    className="input"
                  >
                    <option value="THANK_YOU">🙏 សូមអរគុណ (Thank You / Good Luck)</option>
                    <option value="DIAMOND">💎 Diamonds (ពេជ្រ)</option>
                    <option value="PROMO_CODE">🏷️ Promo Code (កូដបញ្ចុះតម្លៃ)</option>
                    <option value="GAME_PACKAGE">📦 Game Package (កញ្ចប់ហ្គេម)</option>
                    <option value="CUSTOM">✨ Custom Reward (រង្វាន់ផ្សេងៗ)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">ប្រូបាបឈ្នះ % (Probability)</label>
                    {editingSlot.rewardType === "THANK_YOU" && (
                      <span className="text-[10px] text-pink-300 font-bold">ដាក់ % ខ្ពស់ដើម្បីចាប់បានច្រើន</span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={editingSlot.probability}
                    onChange={(e) =>
                      setEditingSlot({ ...editingSlot, probability: parseFloat(e.target.value) || 0 })
                    }
                    className="input font-mono"
                  />
                  {editingSlot.rewardType === "THANK_YOU" && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-purple-300/80">រហ័ស:</span>
                      {[50, 60, 70, 80, 90].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setEditingSlot({ ...editingSlot, probability: p })}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition border cursor-pointer ${
                            editingSlot.probability === p
                              ? "bg-pink-500 text-white border-pink-400 shadow"
                              : "bg-purple-900/50 hover:bg-purple-800/60 text-purple-200 border-purple-500/30"
                          }`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Thank You Note */}
              {editingSlot.rewardType === "THANK_YOU" && (
                <div className="rounded-2xl border border-pink-500/40 bg-pink-950/30 p-4 space-y-2 animate-fade-in shadow-inner">
                  <div className="flex items-center gap-2 text-pink-300 font-bold text-xs">
                    <span className="text-lg">🙏</span>
                    <span>ប្រអប់សូមអរគុណ (Thank You Slot - មិនផ្តល់រង្វាន់/ពេជ្រ)</span>
                  </div>
                  <p className="text-[11px] text-pink-200/80 leading-relaxed">
                    នេះជាប្រអប់ &quot;សូមអរគុណ&quot; (Thank You / Good luck next time) សម្រាប់អ្នកដែលមិនបានឈ្នះរង្វាន់។
                    បងអាចកំណត់ <strong>ប្រូបាប % ខ្ពស់ (ឧ. 50% ដល់ 80%)</strong> ដើម្បីឱ្យអតិថិជនចាប់ចំប្រអប់នេះច្រើនជាងគេ (get more than prizes)!
                  </p>
                  <p className="text-[10px] text-purple-300/70 italic">
                    ✨ មិនត្រូវការ Provider Stock ឬ ID Item ទេ ព្រោះប្រព័ន្ធមិនកាត់ស្តុក ឬបញ្ចូលពេជ្រអ្វីឡើយ។
                  </p>
                </div>
              )}

              {/* Sub-inputs based on Reward Type */}
              {editingSlot.rewardType === "DIAMOND" && (
                <div>
                  <label className="label">ចំនួនពេជ្រ (Diamond Amount)</label>
                  <input
                    type="number"
                    min="1"
                    value={editingSlot.rewardAmount}
                    onChange={(e) =>
                      setEditingSlot({ ...editingSlot, rewardAmount: parseInt(e.target.value) || 0 })
                    }
                    className="input font-mono"
                    placeholder="100"
                  />
                </div>
              )}

              {editingSlot.rewardType === "PROMO_CODE" && (
                <div className="space-y-2">
                  <label className="label">ជ្រើសរើស ឬវាយបញ្ចូលកូដបញ្ចុះតម្លៃ</label>
                  <select
                    value={editingSlot.promoCodeId || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      const selectedPromo = promoCodes.find((p) => p.id === val);
                      setEditingSlot({
                        ...editingSlot,
                        promoCodeId: val || null,
                        rewardValue: selectedPromo ? selectedPromo.code : editingSlot.rewardValue,
                      });
                    }}
                    className="input"
                  >
                    <option value="">-- ឬវាយកូដផ្ទាល់ខ្លួនខាងក្រោម --</option>
                    {promoCodes.map((p) => (
                      <option key={p.id} value={p.id}>
                        🏷️ {p.code} ({p.discountType === "PERCENT" ? `${p.discountValue}%` : `$${p.discountValue}`})
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={editingSlot.rewardValue || ""}
                    onChange={(e) => setEditingSlot({ ...editingSlot, rewardValue: e.target.value.toUpperCase() })}
                    placeholder="ឈ្មោះកូដ e.g. LUCKY20"
                    className="input font-mono uppercase text-xs"
                  />
                </div>
              )}

              {editingSlot.rewardType === "GAME_PACKAGE" && (
                <div>
                  <label className="label">ភ្ជាប់ជាមួយកញ្ចប់ទំនិញ (Linked Product)</label>
                  <select
                    value={editingSlot.productId || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      const selectedProd = products.find((p) => p.id === val);
                      setEditingSlot({
                        ...editingSlot,
                        productId: val || null,
                        rewardValue: selectedProd ? selectedProd.name : "",
                        label: selectedProd ? selectedProd.name : editingSlot.label,
                        rewardAmount: selectedProd?.amount || editingSlot.rewardAmount,
                        supplier: selectedProd?.supplier || editingSlot.supplier || "bay2game",
                        supplierCode: selectedProd?.supplierCode || editingSlot.supplierCode,
                      });
                    }}
                    className="input"
                  >
                    <option value="">-- ជ្រើសរើសកញ្ចប់ --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        📦 {p.name} (${p.priceUsd.toFixed(2)}) {p.supplierCode ? `[${p.supplierCode}]` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editingSlot.rewardType === "CUSTOM" && (
                <div>
                  <label className="label">តម្លៃរង្វាន់ (Custom Value)</label>
                  <input
                    type="text"
                    value={editingSlot.rewardValue || ""}
                    onChange={(e) => setEditingSlot({ ...editingSlot, rewardValue: e.target.value })}
                    placeholder="e.g. Jackpot Surprise Box"
                    className="input"
                  />
                </div>
              )}

              {/* ────────────────────────────────────────────────────────── */}
              {/* ⚡ PROVIDER STOCK & ID ITEM SECTION (CRITICAL REQUIREMENT) */}
              {/* ────────────────────────────────────────────────────────── */}
              {editingSlot.rewardType !== "THANK_YOU" && (
                <div className="rounded-2xl border border-purple-500/30 bg-purple-950/40 p-4 space-y-3.5 shadow-inner">
                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-2.5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-yellow-400" />
                      <span>កំណត់ Provider Stock & ID Item</span>
                    </span>

                    {/* Provider Stock In-Stock Toggle */}
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold">
                      <input
                        type="checkbox"
                        checked={editingSlot.inStock !== false}
                        onChange={(e) => setEditingSlot({ ...editingSlot, inStock: e.target.checked })}
                        className="accent-emerald-500 h-4 w-4 rounded"
                      />
                      <span className={editingSlot.inStock !== false ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                        {editingSlot.inStock !== false ? "🟢 មានស្តុក (In Stock)" : "🔴 អស់ស្តុក (Out of Stock)"}
                      </span>
                    </label>
                  </div>

                  {/* API Provider Selector */}
                  <div>
                    <label className="text-[11px] font-semibold text-purple-200 mb-1.5 block">
                      ជ្រើសរើស Provider Stock:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {PROVIDER_OPTIONS.map((prov) => {
                        const isSelected = (editingSlot.supplier || "bay2game") === prov.id;
                        return (
                          <button
                            key={prov.id}
                            type="button"
                            onClick={() => setEditingSlot({ ...editingSlot, supplier: prov.id })}
                            className={`px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-purple-600 border-purple-300 text-white shadow-lg shadow-purple-600/30 ring-1 ring-white/20"
                                : "bg-purple-900/30 border-purple-500/20 text-purple-300 hover:bg-purple-800/40 hover:text-white"
                            }`}
                          >
                            <span>{prov.icon}</span>
                            <span>{prov.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ID Item (supplierCode) Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-purple-200">
                        ID Item / Provider Item Code (កូដទំនិញក្នុងស្តុក Provider):
                      </label>
                      <span className="text-[10px] text-yellow-300 font-mono">
                        {editingSlot.supplierCode ? `ID: ${editingSlot.supplierCode}` : "គ្មានកូដ"}
                      </span>
                    </div>

                    <input
                      type="text"
                      value={editingSlot.supplierCode || ""}
                      onChange={(e) => setEditingSlot({ ...editingSlot, supplierCode: e.target.value })}
                      placeholder={
                        PROVIDER_OPTIONS.find((p) => p.id === (editingSlot.supplier || "bay2game"))?.codePlaceholder ||
                        "e.g. 50, ML50, 102, FF100"
                      }
                      className="input font-mono text-xs uppercase bg-black/40 border-purple-400/40 text-yellow-300 font-bold focus:border-yellow-400"
                    />
                    <p className="text-[10px] text-purple-300/70 mt-1">
                      បញ្ចូលលេខកូដកញ្ចប់ ឬ ID Item ដែលត្រូវទិញចេញពី Provider Stock (ឧទាហរណ៍ ML50, 102, ff:100...)
                    </p>
                  </div>

                  {/* Quick Autofill from existing product */}
                  {products.length > 0 && (
                    <div className="pt-2 border-t border-purple-500/20">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold text-purple-300">⚡ Autofill ពីទំនិញដែលមានស្រាប់:</span>
                        <select
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-purple-400/30 bg-purple-900/60 text-purple-200 cursor-pointer outline-none hover:bg-purple-800/60 max-w-[200px] truncate"
                          onChange={(e) => {
                            const pId = e.target.value;
                            if (!pId) return;
                            const p = products.find((item) => item.id === pId);
                            if (!p) return;
                            setEditingSlot({
                              ...editingSlot,
                              label: p.name,
                              rewardAmount: p.amount || editingSlot.rewardAmount,
                              supplier: p.supplier || editingSlot.supplier || "bay2game",
                              supplierCode: p.supplierCode || editingSlot.supplierCode,
                              productId: p.id,
                            });
                            e.target.value = "";
                          }}
                          defaultValue=""
                        >
                          <option value="">ជ្រើសរើសដើម្បី Autofill...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.supplierCode ? `[${p.supplierCode}]` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Active Toggle */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingSlot.active}
                    onChange={(e) => setEditingSlot({ ...editingSlot, active: e.target.checked })}
                    className="accent-purple-500 h-4 w-4 rounded"
                  />
                  <span className="text-sm font-semibold text-white">បើកដំណើរការកាដូនេះ (Active)</span>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 pt-4 border-t border-purple-500/20 mt-4">
              <button
                type="button"
                onClick={() => setEditingSlot(null)}
                className="btn-secondary text-xs px-3 py-2 cursor-pointer"
              >
                បោះបង់ (Cancel)
              </button>
              <button
                type="button"
                onClick={() => handleSaveSlot(editingSlot)}
                className="btn-primary text-xs px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                រួចរាល់ (Apply)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
