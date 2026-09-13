"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import LuckyWheel, { WheelSlot } from "@/components/LuckyWheel";
import {
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
  BarChart3,
  Layers,
  History,
  Eye,
  Sliders,
  Check,
  X,
  RotateCw,
} from "lucide-react";

interface AdminGame {
  id: string;
  name: string;
  slug: string;
  currencyName: string;
}

interface AdminSlot {
  id?: string;
  label: string;
  rewardType: string;
  rewardAmount: number;
  probability: number;
  color: string;
  textColor: string;
  icon?: string | null;
  sortOrder: number;
  supplier: string;
  supplierCode?: string | null;
}

interface AdminPackage {
  id: string;
  gameId: string;
  game: { id: string; name: string; slug: string };
  name: string;
  description?: string | null;
  priceUsd: number;
  priceKhr?: number | null;
  badge?: string | null;
  active: boolean;
  sortOrder: number;
  maxSpinsPerUserDaily?: number | null;
  slots: AdminSlot[];
  _count?: { transactions: number; orders: number };
  createdAt: string;
}

interface SpinAuditItem {
  id: string;
  orderNumber: string;
  playerUid: string;
  serverId?: string | null;
  playerNickname?: string | null;
  status: "PENDING" | "SPUN" | "COMPLETED" | "FAILED";
  winningRewardLabel?: string | null;
  winningRewardAmount?: number | null;
  fulfillmentRef?: string | null;
  errorMessage?: string | null;
  clientIp?: string | null;
  createdAt: string;
  spunAt?: string | null;
  claimedAt?: string | null;
  package?: { id: string; name: string; priceUsd: number };
  order?: {
    id: string;
    orderNumber: string;
    amountUsd: number;
    paymentMethod: string;
    game?: { name: string; imageUrl?: string };
  };
}

interface SpinAnalytics {
  totalSpins: number;
  totalRevenueUsd: number;
  statusSummary: Record<string, number>;
  winDistribution: Array<{ label: string; count: number }>;
}

const DEFAULT_COLORS = [
  "#EC4899", // pink-500
  "#3B82F6", // blue-500
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#8B5CF6", // purple-500
  "#EF4444", // red-500
  "#06B6D4", // cyan-500
  "#84CC16", // lime-500
];

export default function AdminLuckyWheelPage() {
  const [activeTab, setActiveTab] = useState<"packages" | "analytics" | "history">("packages");
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<AdminGame[]>([]);
  const [packages, setPackages] = useState<AdminPackage[]>([]);

  // Package modal state
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageName, setPackageName] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");
  const [priceUsd, setPriceUsd] = useState("1.00");
  const [badge, setBadge] = useState("🔥 MYSTERY BOX");
  const [description, setDescription] = useState("");
  const [packageActive, setPackageActive] = useState(true);
  const [dailyLimit, setDailyLimit] = useState("");

  // Slots in builder
  const [modalSlots, setModalSlots] = useState<AdminSlot[]>([
    {
      label: "50 Diamonds",
      rewardType: "DIAMOND",
      rewardAmount: 50,
      probability: 60,
      color: "#EC4899",
      textColor: "#FFFFFF",
      sortOrder: 0,
      supplier: "bay2game",
      supplierCode: "ML50",
    },
    {
      label: "150 Diamonds",
      rewardType: "DIAMOND",
      rewardAmount: 150,
      probability: 30,
      color: "#3B82F6",
      textColor: "#FFFFFF",
      sortOrder: 1,
      supplier: "bay2game",
      supplierCode: "ML150",
    },
    {
      label: "500 Diamonds Jackpot",
      rewardType: "DIAMOND",
      rewardAmount: 500,
      probability: 10,
      color: "#F59E0B",
      textColor: "#FFFFFF",
      sortOrder: 2,
      supplier: "bay2game",
      supplierCode: "ML500",
    },
  ]);

  const [savingPackage, setSavingPackage] = useState(false);
  const [packageError, setPackageError] = useState<string | null>(null);

  // History & Analytics State
  const [spins, setSpins] = useState<SpinAuditItem[]>([]);
  const [analytics, setAnalytics] = useState<SpinAnalytics | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Show temporary toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch games & packages
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [gRes, pRes] = await Promise.all([
        fetch("/api/admin/games"),
        fetch("/api/admin/random-packages"),
      ]);
      const gData = await gRes.json();
      const pData = await pRes.json();
      if (Array.isArray(gData)) setGames(gData);
      if (Array.isArray(pData)) {
        setPackages(pData);
        if (gData.length > 0 && !selectedGameId) {
          setSelectedGameId(gData[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load wheel admin data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedGameId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Fetch history & analytics
  const loadHistoryAndAnalytics = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const q = new URLSearchParams({
        page: String(historyPage),
        limit: "15",
      });
      if (historySearch) q.set("search", historySearch);
      if (historyStatus) q.set("status", historyStatus);

      const res = await fetch(`/api/admin/spins?${q.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setSpins(data.spins || []);
        setHistoryTotalPages(data.pagination?.totalPages || 1);
        if (data.analytics) setAnalytics(data.analytics);
      }
    } catch (err) {
      console.error("Failed to load spins history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, historySearch, historyStatus]);

  useEffect(() => {
    if (activeTab === "history" || activeTab === "analytics") {
      loadHistoryAndAnalytics();
    }
  }, [activeTab, loadHistoryAndAnalytics]);

  // Calculated total probability
  const totalProbability = useMemo(() => {
    return Number(modalSlots.reduce((acc, s) => acc + (Number(s.probability) || 0), 0).toFixed(2));
  }, [modalSlots]);

  // Handle open create modal
  const handleOpenCreate = () => {
    setEditingPackageId(null);
    setPackageName("");
    if (games.length > 0) setSelectedGameId(games[0].id);
    setPriceUsd("1.00");
    setBadge("🔥 MYSTERY BOX");
    setDescription("");
    setPackageActive(true);
    setDailyLimit("");
    setModalSlots([
      {
        label: "50 Diamonds",
        rewardType: "DIAMOND",
        rewardAmount: 50,
        probability: 60,
        color: "#EC4899",
        textColor: "#FFFFFF",
        sortOrder: 0,
        supplier: "bay2game",
        supplierCode: "ML50",
      },
      {
        label: "150 Diamonds",
        rewardType: "DIAMOND",
        rewardAmount: 150,
        probability: 30,
        color: "#3B82F6",
        textColor: "#FFFFFF",
        sortOrder: 1,
        supplier: "bay2game",
        supplierCode: "ML150",
      },
      {
        label: "500 Diamonds Jackpot",
        rewardType: "DIAMOND",
        rewardAmount: 500,
        probability: 10,
        color: "#F59E0B",
        textColor: "#FFFFFF",
        sortOrder: 2,
        supplier: "bay2game",
        supplierCode: "ML500",
      },
    ]);
    setPackageError(null);
    setShowPackageModal(true);
  };

  // Handle open edit modal
  const handleOpenEdit = (pkg: AdminPackage) => {
    setEditingPackageId(pkg.id);
    setPackageName(pkg.name);
    setSelectedGameId(pkg.gameId);
    setPriceUsd(String(pkg.priceUsd));
    setBadge(pkg.badge || "");
    setDescription(pkg.description || "");
    setPackageActive(pkg.active);
    setDailyLimit(pkg.maxSpinsPerUserDaily ? String(pkg.maxSpinsPerUserDaily) : "");
    setModalSlots(
      pkg.slots.map((s, idx) => ({
        id: s.id,
        label: s.label,
        rewardType: s.rewardType,
        rewardAmount: s.rewardAmount,
        probability: s.probability,
        color: s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
        textColor: s.textColor || "#FFFFFF",
        sortOrder: s.sortOrder ?? idx,
        supplier: s.supplier || "bay2game",
        supplierCode: s.supplierCode || "",
      }))
    );
    setPackageError(null);
    setShowPackageModal(true);
  };

  // Slot mutations
  const handleAddSlot = () => {
    const nextIdx = modalSlots.length;
    setModalSlots([
      ...modalSlots,
      {
        label: `Reward ${nextIdx + 1}`,
        rewardType: "DIAMOND",
        rewardAmount: 100,
        probability: 0,
        color: DEFAULT_COLORS[nextIdx % DEFAULT_COLORS.length],
        textColor: "#FFFFFF",
        sortOrder: nextIdx,
        supplier: "bay2game",
        supplierCode: "",
      },
    ]);
  };

  const handleRemoveSlot = (index: number) => {
    if (modalSlots.length <= 2) {
      setPackageError("At least 2 slots are required for the Lucky Wheel");
      return;
    }
    const updated = modalSlots.filter((_, idx) => idx !== index);
    setModalSlots(updated);
  };

  const handleUpdateSlot = (index: number, field: keyof AdminSlot, val: any) => {
    const updated = [...modalSlots];
    updated[index] = { ...updated[index], [field]: val };
    setModalSlots(updated);
  };

  // Save package
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setPackageError(null);

    if (!packageName.trim()) {
      setPackageError("Package name is required");
      return;
    }
    if (!selectedGameId) {
      setPackageError("Please select a game");
      return;
    }
    const price = parseFloat(priceUsd);
    if (isNaN(price) || price <= 0) {
      setPackageError("Please enter a valid price greater than 0");
      return;
    }
    if (modalSlots.length < 2) {
      setPackageError("Wheel must have at least 2 reward slots");
      return;
    }
    if (Math.abs(totalProbability - 100) > 0.05) {
      setPackageError(`Slot probabilities must sum to 100%. Current total: ${totalProbability}%`);
      return;
    }

    setSavingPackage(true);
    try {
      const payload = {
        gameId: selectedGameId,
        name: packageName.trim(),
        badge: badge.trim() || null,
        description: description.trim() || null,
        priceUsd: price,
        active: packageActive,
        maxSpinsPerUserDaily: dailyLimit ? parseInt(dailyLimit, 10) : null,
        slots: modalSlots.map((s, idx) => ({
          id: s.id,
          label: s.label.trim(),
          rewardType: s.rewardType,
          rewardAmount: parseInt(String(s.rewardAmount), 10) || 0,
          probability: parseFloat(String(s.probability)) || 0,
          color: s.color,
          textColor: s.textColor || "#FFFFFF",
          sortOrder: idx,
          supplier: s.supplier,
          supplierCode: s.supplierCode ? s.supplierCode.trim() : null,
        })),
      };

      const url = editingPackageId
        ? `/api/admin/random-packages/${editingPackageId}`
        : "/api/admin/random-packages";
      const method = editingPackageId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Failed to save package");
      }

      showToast(editingPackageId ? "Package updated successfully!" : "New Mystery Box created!");
      setShowPackageModal(false);
      loadInitialData();
    } catch (err: any) {
      setPackageError(err.message || "Failed to save package");
    } finally {
      setSavingPackage(false);
    }
  };

  // Delete package
  const handleDeletePackage = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete package "${name}"? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/random-packages/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Package deleted successfully");
        loadInitialData();
      } else {
        const j = await res.json();
        alert(j.error || "Failed to delete package");
      }
    } catch (err) {
      alert("Error deleting package");
    }
  };

  // Toggle active status
  const handleToggleActive = async (pkg: AdminPackage) => {
    try {
      const res = await fetch(`/api/admin/random-packages/${pkg.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !pkg.active }),
      });
      if (res.ok) {
        setPackages((prev) =>
          prev.map((p) => (p.id === pkg.id ? { ...p, active: !p.active } : p))
        );
        showToast(`Package is now ${!pkg.active ? "ACTIVE" : "INACTIVE"}`);
      }
    } catch (err) {
      alert("Failed to toggle status");
    }
  };

  // Retry delivery action
  const handleRetryDelivery = async (spinId: string) => {
    if (!confirm("Retry top-up delivery for this spin? This will call the supplier API again.")) return;
    setActionLoadingId(spinId);
    try {
      const res = await fetch(`/api/admin/spins/${spinId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry_delivery" }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Fulfillment triggered successfully!");
        loadHistoryAndAnalytics();
      } else {
        alert(data.error || "Retry failed");
      }
    } catch (err) {
      alert("Error executing retry");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Blacklist player action
  const handleBlacklistPlayer = async (spinId: string, playerUid: string) => {
    const reason = prompt(`Reason for blacklisting player ${playerUid}:`, "Suspicious activity / chargeback attempt");
    if (!reason) return;
    setActionLoadingId(spinId);
    try {
      const res = await fetch(`/api/admin/spins/${spinId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "blacklist", reason }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Player ${playerUid} has been banned!`);
      } else {
        alert(data.error || "Failed to ban player");
      }
    } catch (err) {
      alert("Error banning player");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Wheel preview slots
  const previewSlots: WheelSlot[] = useMemo(() => {
    return modalSlots.map((s, idx) => ({
      id: s.id || `slot-${idx}`,
      label: s.label || `Slot ${idx + 1}`,
      rewardType: s.rewardType,
      rewardAmount: Number(s.rewardAmount) || 0,
      probability: Number(s.probability) || 0,
      color: s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
      textColor: s.textColor || "#FFFFFF",
      icon: s.icon,
    }));
  }, [modalSlots]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-pink-500 animate-slide-up">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-pink-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎡</span>
            <h1 className="text-2xl font-bold text-gray-900">Lucky Wheel & Mystery Boxes</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Configure Mystery Diamond packages, customizable wheel odds, live analytics & spin transaction logs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-semibold text-sm shadow-md shadow-pink-200 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Mystery Package</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("packages")}
          className={`pb-3 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === "packages"
              ? "border-pink-600 text-pink-600 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Packages ({packages.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`pb-3 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === "analytics"
              ? "border-pink-600 text-pink-600 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Analytics & Win Odds</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === "history"
              ? "border-pink-600 text-pink-600 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Spin Audit History</span>
        </button>
      </div>

      {/* Tab 1: Packages List */}
      {activeTab === "packages" && (
        <div className="space-y-4">
          {packages.length === 0 && !loading && (
            <div className="p-12 text-center bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">No Mystery Packages Yet</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
                Create your first Mystery Diamond Box for Mobile Legends, Free Fire, or other games to let players spin the lucky wheel!
              </p>
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-600 text-white font-semibold text-sm shadow cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Package</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="bg-white rounded-2xl border border-pink-100/80 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between"
              >
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-pink-50 text-pink-700 text-xs font-semibold mb-2">
                        {pkg.badge || "MYSTERY BOX"}
                      </div>
                      <h3 className="font-bold text-gray-900 text-lg">{pkg.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Game: <span className="font-medium text-gray-700">{pkg.game.name}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-extrabold text-pink-600">${pkg.priceUsd.toFixed(2)}</div>
                      <button
                        onClick={() => handleToggleActive(pkg)}
                        className={`mt-1 text-[11px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                          pkg.active
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {pkg.active ? "● ACTIVE" : "○ INACTIVE"}
                      </button>
                    </div>
                  </div>

                  {pkg.description && (
                    <p className="text-xs text-gray-600 line-clamp-2">{pkg.description}</p>
                  )}

                  {/* Wheel Slice preview pill list */}
                  <div className="border-t border-gray-100 pt-3">
                    <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center justify-between">
                      <span>Wheel Slots ({pkg.slots.length})</span>
                      <span className="text-[10px] text-gray-400">Sum: 100%</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {pkg.slots.map((s) => (
                        <div
                          key={s.id || s.label}
                          style={{ backgroundColor: s.color + "20", borderColor: s.color }}
                          className="px-2 py-1 rounded-md border text-[11px] font-medium flex items-center gap-1"
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="text-gray-800">{s.label}</span>
                          <span className="text-gray-500 text-[10px]">({s.probability}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="px-5 py-3 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between text-xs">
                  <div className="text-gray-400">
                    Spins: <span className="font-semibold text-gray-700">{pkg._count?.transactions || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(pkg)}
                      className="p-1.5 text-gray-600 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit package & slots"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePackage(pkg.id, pkg.name)}
                      className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete package"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Analytics & Odds */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Spin Revenue</div>
              <div className="text-2xl font-extrabold text-pink-600 mt-2">
                ${(analytics?.totalRevenueUsd || 0).toFixed(2)}
              </div>
              <div className="text-xs text-gray-400 mt-1">From completed mystery orders</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Spins Executed</div>
              <div className="text-2xl font-extrabold text-gray-900 mt-2">
                {analytics?.totalSpins || 0}
              </div>
              <div className="text-xs text-emerald-600 font-medium mt-1">
                Completed: {analytics?.statusSummary?.COMPLETED || 0}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Spins</div>
              <div className="text-2xl font-extrabold text-amber-500 mt-2">
                {analytics?.statusSummary?.PENDING || 0}
              </div>
              <div className="text-xs text-gray-400 mt-1">Paid, awaiting customer spin</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Failed Deliveries</div>
              <div className="text-2xl font-extrabold text-red-500 mt-2">
                {analytics?.statusSummary?.FAILED || 0}
              </div>
              <div className="text-xs text-gray-400 mt-1">Needs admin retry/check</div>
            </div>
          </div>

          {/* Win Distribution Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-2">Prizes Won Distribution</h3>
            <p className="text-xs text-gray-500 mb-6">
              Track actual wins across all mystery box spins to verify mathematical fairness
            </p>

            {analytics?.winDistribution && analytics.winDistribution.length > 0 ? (
              <div className="space-y-4 max-w-2xl">
                {analytics.winDistribution.map((item) => {
                  const total = analytics.totalSpins || 1;
                  const pct = ((item.count / total) * 100).toFixed(1);
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-800">{item.label}</span>
                        <span className="text-gray-500">
                          {item.count} wins ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-pink-500 to-rose-400 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No win data recorded yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Spin Audit History */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                placeholder="Search Order # or Player UID..."
                className="px-3.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-pink-500 w-full sm:w-64"
              />

              <select
                value={historyStatus}
                onChange={(e) => {
                  setHistoryStatus(e.target.value);
                  setHistoryPage(1);
                }}
                className="px-3.5 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-pink-500 cursor-pointer bg-white"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="SPUN">SPUN</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <a
                href="/api/admin/spins?export=csv"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-gray-500" />
                <span>Export to CSV</span>
              </a>

              <button
                onClick={loadHistoryAndAnalytics}
                className="p-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
                title="Refresh logs"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Spins Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Player UID</th>
                  <th className="py-3 px-4">Package</th>
                  <th className="py-3 px-4">Reward Won</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {spins.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400 italic">
                      {historyLoading ? "Loading spin logs..." : "No spin transactions found."}
                    </td>
                  </tr>
                )}
                {spins.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-pink-600">
                      <a href={`/spin/${s.orderNumber}`} target="_blank" rel="noreferrer" className="hover:underline">
                        {s.orderNumber}
                      </a>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <div>{s.playerUid}</div>
                      {s.serverId && <span className="text-gray-400 text-[10px]">Zone: {s.serverId}</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-900">{s.package?.name || "Mystery Box"}</div>
                      <div className="text-[10px] text-gray-400">${s.order?.amountUsd?.toFixed(2) || "0.00"}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {s.winningRewardLabel ? (
                        <span className="font-bold text-gray-900 bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                          {s.winningRewardLabel}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Not spun yet</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          s.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-700"
                            : s.status === "SPUN"
                            ? "bg-blue-100 text-blue-700"
                            : s.status === "FAILED"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-400 text-[11px]">
                      {new Date(s.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5">
                      {/* Retry top-up button if failed */}
                      {s.status === "FAILED" && (
                        <button
                          onClick={() => handleRetryDelivery(s.id)}
                          disabled={actionLoadingId === s.id}
                          className="px-2 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 text-[10px] font-bold cursor-pointer"
                        >
                          Retry Delivery
                        </button>
                      )}

                      {/* Ban player UID */}
                      <button
                        onClick={() => handleBlacklistPlayer(s.id, s.playerUid)}
                        disabled={actionLoadingId === s.id}
                        className="px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 text-[10px] font-medium cursor-pointer"
                        title="Blacklist Player UID"
                      >
                        Ban UID
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <div>
                Page <span className="font-bold text-gray-800">{historyPage}</span> of{" "}
                <span className="font-bold text-gray-800">{historyTotalPages}</span>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  disabled={historyPage >= historyTotalPages}
                  onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                  className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Package Creation / Editing Modal */}
      {showPackageModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl border border-pink-100 max-h-[92vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <h2 className="text-xl font-extrabold text-gray-900">
                {editingPackageId ? "Edit Mystery Package & Slots" : "Create New Mystery Package"}
              </h2>
              <button
                onClick={() => setShowPackageModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {packageError && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{packageError}</span>
              </div>
            )}

            <form onSubmit={handleSavePackage} className="space-y-6">
              {/* Top Configuration Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Target Game *</label>
                  <select
                    value={selectedGameId}
                    onChange={(e) => setSelectedGameId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:border-pink-500 outline-none cursor-pointer bg-white"
                  >
                    {games.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Package Name *</label>
                  <input
                    type="text"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    placeholder="e.g. MLBB Super Mystery Box"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:border-pink-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Price (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.05"
                    value={priceUsd}
                    onChange={(e) => setPriceUsd(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:border-pink-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Badge Tag</label>
                  <input
                    type="text"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    placeholder="e.g. 🔥 HOT or 💎 99% WIN"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:border-pink-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Daily Spin Limit / User</label>
                  <input
                    type="number"
                    min="1"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    placeholder="Leave empty for unlimited"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:border-pink-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="packageActiveCheckbox"
                    checked={packageActive}
                    onChange={(e) => setPackageActive(e.target.checked)}
                    className="w-4 h-4 text-pink-600 rounded cursor-pointer"
                  />
                  <label htmlFor="packageActiveCheckbox" className="text-xs font-bold text-gray-800 cursor-pointer">
                    Enable Package on Storefront
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description / Rules</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Spin to win 50 to 1,000 diamonds! Guaranteed 100% win on every spin."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:border-pink-500 outline-none"
                />
              </div>

              {/* Slot Editor & Wheel Preview */}
              <div className="border-t border-gray-100 pt-6">
                <div className="flex flex-col lg:flex-row items-start gap-8">
                  {/* Left Column: Slots Table / Form */}
                  <div className="flex-1 w-full space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">Wheel Slices & Probabilities</h3>
                        <p className="text-xs text-gray-500">Configure prizes, win percentages, and topup codes</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                            Math.abs(totalProbability - 100) < 0.05
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          Total: {totalProbability}% / 100%
                        </span>
                        <button
                          type="button"
                          onClick={handleAddSlot}
                          className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Slice</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {modalSlots.map((slot, index) => (
                        <div
                          key={index}
                          className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3"
                        >
                          <div className="grid grid-cols-12 gap-2 items-center">
                            {/* Color preview / picker */}
                            <div className="col-span-2 sm:col-span-1">
                              <input
                                type="color"
                                value={slot.color}
                                onChange={(e) => handleUpdateSlot(index, "color", e.target.value)}
                                className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                                title="Pick slice color"
                              />
                            </div>

                            {/* Label */}
                            <div className="col-span-6 sm:col-span-4">
                              <input
                                type="text"
                                value={slot.label}
                                onChange={(e) => handleUpdateSlot(index, "label", e.target.value)}
                                placeholder="Reward Label"
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 bg-white"
                                required
                              />
                            </div>

                            {/* Reward Amount */}
                            <div className="col-span-4 sm:col-span-2">
                              <input
                                type="number"
                                min="0"
                                value={slot.rewardAmount}
                                onChange={(e) =>
                                  handleUpdateSlot(index, "rewardAmount", parseInt(e.target.value) || 0)
                                }
                                placeholder="Diamonds"
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 bg-white"
                                title="Reward Amount"
                              />
                            </div>

                            {/* Probability */}
                            <div className="col-span-6 sm:col-span-2">
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  value={slot.probability}
                                  onChange={(e) =>
                                    handleUpdateSlot(index, "probability", parseFloat(e.target.value) || 0)
                                  }
                                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 bg-white pr-5"
                                  placeholder="%"
                                  title="Win Probability %"
                                />
                                <span className="absolute right-1.5 top-1.5 text-[10px] text-gray-400">%</span>
                              </div>
                            </div>

                            {/* Supplier Code */}
                            <div className="col-span-5 sm:col-span-2">
                              <input
                                type="text"
                                value={slot.supplierCode || ""}
                                onChange={(e) => handleUpdateSlot(index, "supplierCode", e.target.value)}
                                placeholder="Code (e.g. ML50)"
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 bg-white font-mono"
                                title="Upstream Supplier Product Code"
                              />
                            </div>

                            {/* Delete slot */}
                            <div className="col-span-1 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveSlot(index)}
                                className="text-gray-400 hover:text-red-500 p-1 cursor-pointer"
                                title="Remove slice"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Live Wheel Interactive Preview */}
                  <div className="w-full lg:w-72 shrink-0 flex flex-col items-center bg-pink-50/40 rounded-2xl p-4 border border-pink-100">
                    <div className="text-xs font-bold text-pink-700 uppercase tracking-widest mb-3 flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Live Wheel Preview</span>
                    </div>

                    <div className="scale-75 -my-8 origin-center">
                      <LuckyWheel
                        slots={previewSlots}
                        size={300}
                        onSpinEnd={(slot) => alert(`Preview test won: ${slot.label}!`)}
                      />
                    </div>

                    <p className="text-[11px] text-gray-500 text-center mt-4">
                      Click the center button in preview to test animation physics and audio ticks!
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowPackageModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPackage}
                  className="px-6 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-bold shadow-md shadow-pink-200 cursor-pointer disabled:opacity-50"
                >
                  {savingPackage ? "Saving..." : editingPackageId ? "Update Package" : "Create Package"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

