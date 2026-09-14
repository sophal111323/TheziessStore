"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import LuckyWheel, { WheelSlot } from "@/components/LuckyWheel";
import Link from "next/link";
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Trophy,
  Copy,
  Check,
  RotateCcw,
  ChevronRight,
  Package,
  User,
  Gamepad2,
} from "lucide-react";

interface SpinPageData {
  orderNumber: string;
  status: "PENDING" | "SPUN" | "COMPLETED" | "FAILED";
  playerUid: string;
  serverId?: string | null;
  playerNickname?: string | null;
  game: {
    id: string;
    slug: string;
    name: string;
    imageUrl: string;
    currencyName: string;
    uidLabel: string;
  };
  package: {
    id: string;
    name: string;
    badge?: string | null;
    imageUrl?: string | null;
    description?: string | null;
  };
  slots: WheelSlot[];
  winningSlotId?: string | null;
  winningRewardAmount?: number | null;
  winningRewardLabel?: string | null;
  spunAt?: string | null;
  claimedAt?: string | null;
  fulfillmentRef?: string | null;
  fulfillmentStatus?: string | null;
  deliveryError?: string | null;
}

export default function SpinWheelClient({ orderNumber }: { orderNumber: string }) {
  const [data, setData] = useState<SpinPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [wonSlot, setWonSlot] = useState<WheelSlot | null>(null);
  const [showWinModal, setShowWinModal] = useState(false);

  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);

  const autoClaimTriggeredRef = useRef(false);

  // Execute Claim API automatically without requiring manual user button click
  const executeAutoClaim = useCallback(
    async (targetSlot?: WheelSlot | null) => {
      if (claiming) return;

      try {
        setClaiming(true);
        setClaimError(null);

        const res = await fetch(`/api/spin/${encodeURIComponent(orderNumber)}/claim`, {
          method: "POST",
        });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "បរាជ័យក្នុងការផ្ញើរង្វាន់ពេជ្រ សូមព្យាយាមម្តងទៀត");
        }

        setClaimSuccess(true);

        // Update local state to COMPLETED & Expired
        setData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            status: "COMPLETED",
            winningRewardLabel:
              json.rewardLabel || targetSlot?.label || prev.winningRewardLabel,
            winningRewardAmount:
              json.rewardAmount ?? targetSlot?.rewardAmount ?? prev.winningRewardAmount,
            claimedAt: json.claimedAt || new Date().toISOString(),
            fulfillmentRef: json.fulfillmentRef || prev.fulfillmentRef,
          };
        });

        // Keep celebration modal visible briefly to show success, then transition to expired certificate
        window.setTimeout(() => {
          setShowWinModal(false);
        }, 2800);
      } catch (err: any) {
        setClaimError(err.message || "មិនអាចផ្ញើរង្វាន់បានទេ សូមចុចសាកល្បងម្ដងទៀត");
      } finally {
        setClaiming(false);
      }
    },
    [claiming, orderNumber]
  );

  // Fetch spin state
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/spin/${encodeURIComponent(orderNumber)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "មិនអាចទាញយកព័ត៌មានកងបង្វិលបានទេ");
      }
      setData(json);

      // Locate winning slot if previously determined or completed
      if (json.winningSlotId) {
        const found = json.slots?.find((s: WheelSlot) => s.id === json.winningSlotId);
        if (found) setWonSlot(found);
      } else if (json.winningRewardLabel) {
        const found = json.slots?.find((s: WheelSlot) => s.label === json.winningRewardLabel);
        if (found) setWonSlot(found);
      }

      // If already spun and waiting for claim, auto-trigger claim!
      if (json.status === "SPUN" && json.winningSlotId) {
        const found = json.slots?.find((s: WheelSlot) => s.id === json.winningSlotId);
        if (found) {
          setWonSlot(found);
          setShowWinModal(true);
          if (!autoClaimTriggeredRef.current) {
            autoClaimTriggeredRef.current = true;
            void executeAutoClaim(found);
          }
        }
      } else if (json.status === "COMPLETED") {
        setClaimSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || "មានបញ្ហាមិនប្រក្រតីកើតឡើង");
    } finally {
      setLoading(false);
    }
  }, [orderNumber, executeAutoClaim]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Execute Spin (Server-Authoritative Cryptographic RNG)
  const handleSpinStart = async () => {
    if (spinning || !data || data.status === "COMPLETED" || claimSuccess) return;

    try {
      setSpinning(true);
      setError(null);
      setClaimError(null);

      const res = await fetch(`/api/spin/${encodeURIComponent(orderNumber)}/spin`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "ការបង្វិលកងមិនបានសម្រេច");
      }

      // Set target index returned from server-side cryptographic outcome
      setTargetIndex(json.winningIndex);
    } catch (err: any) {
      setSpinning(false);
      setError(err.message || "Spin failed");
    }
  };

  // Wheel animation complete: immediately show celebration and auto-claim!
  const handleSpinEnd = (slot: WheelSlot) => {
    setSpinning(false);
    setWonSlot(slot);
    setShowWinModal(true);

    // 🔥 AUTOMATICALLY CALL CLAIM API (NO BUTTON CLICK NEEDED)
    if (!autoClaimTriggeredRef.current) {
      autoClaimTriggeredRef.current = true;
      void executeAutoClaim(slot);
    }
  };

  const copyUid = async () => {
    if (!data?.playerUid) return;
    try {
      await navigator.clipboard.writeText(data.playerUid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 1500);
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[65vh] flex-col items-center justify-center gap-4 px-4">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 shadow-xl shadow-pink-500/20">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
        <p className="font-display text-sm font-black text-pink-700">
          កំពុងរៀបចំកង់សំណាង TheziessStore...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-3xl border border-red-300/80 bg-red-50/90 p-8 shadow-xl shadow-red-200/40 backdrop-blur-md">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="font-display text-xl font-black text-red-950">
            មិនអាចដំណើរការកងបង្វិលបានទេ
          </h2>
          <p className="mt-2 text-sm font-semibold text-red-700 leading-relaxed">
            {error || "រកមិនឃើញការបញ្ជាទិញនេះឡើយ"}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="rounded-2xl border border-pink-300 bg-white px-5 py-3 text-xs font-black text-pink-700 shadow-sm hover:bg-pink-50"
            >
              ត្រឡប់ទៅទំព័រដើម
            </Link>
            <Link
              href={`/checkout/${orderNumber}`}
              className="rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 px-5 py-3 text-xs font-black text-white shadow-md shadow-pink-300/40 hover:brightness-110"
            >
              ពិនិត្យការទូទាត់
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isCompleted = data.status === "COMPLETED" || claimSuccess;
  const prizeLabel =
    data.winningRewardLabel ||
    (wonSlot ? wonSlot.label : "Diamond Reward");

  // Image configured in admin panel: slice custom icon -> data.slots match -> package logo -> game logo
  const wonRewardImage = (() => {
    if (wonSlot?.icon && (wonSlot.icon.startsWith("http") || wonSlot.icon.startsWith("/"))) {
      return wonSlot.icon;
    }
    if (data?.slots) {
      const match = data.slots.find(
        (s: WheelSlot) =>
          (wonSlot?.id && s.id === wonSlot.id) ||
          (wonSlot?.label && s.label?.trim().toLowerCase() === wonSlot.label?.trim().toLowerCase())
      );
      if (match?.icon && (match.icon.startsWith("http") || match.icon.startsWith("/"))) {
        return match.icon;
      }
    }
    if (data?.package?.imageUrl) {
      return data.package.imageUrl;
    }
    if (data?.game?.imageUrl) {
      return data.game.imageUrl;
    }
    return null;
  })();

  return (
    <div className="relative min-h-[85vh] overflow-hidden px-4 py-8 sm:py-12 sm:px-6">
      {/* ── Ambient Background Lighting ── */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-[450px] w-[450px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-pink-500/25 via-purple-600/20 to-amber-400/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-10 right-10 h-72 w-72 rounded-full bg-rose-500/15 blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-4xl">
        {/* ── Top Header & Player Badge ── */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-300/80 bg-white/90 px-4 py-1.5 text-xs font-black text-pink-700 shadow-sm backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
            <span>{data.package.badge || "🔥 MYSTERY DIAMOND BOX"}</span>
          </div>

          <h1 className="mt-3 font-display text-3xl sm:text-5xl font-black tracking-tight text-gray-900 drop-shadow-sm">
            {data.package.name}
          </h1>

          <p className="mt-2 text-xs sm:text-sm font-bold text-pink-600 max-w-md mx-auto">
            {data.package.description || "បង្វិលកងសំណាងដើម្បីឈ្នះរង្វាន់ Diamonds ធំៗពី TheziessStore!"}
          </p>

          {/* Player Identity Card */}
          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2.5 rounded-2xl border border-pink-200 bg-white/95 px-4 py-2.5 text-xs shadow-sm backdrop-blur-md">
            {data.game.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.game.imageUrl}
                alt={data.game.name}
                className="h-5 w-5 rounded-md object-cover shadow-xs"
              />
            )}
            <span className="font-bold text-gray-600">{data.game.name}:</span>

            <button
              type="button"
              onClick={copyUid}
              className="inline-flex items-center gap-1.5 font-mono font-black text-pink-800 hover:text-pink-600 transition"
              title="Click to copy UID"
            >
              <span>{data.playerUid}</span>
              {data.serverId ? <span className="text-gray-400">({data.serverId})</span> : null}
              {copiedUid ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3 text-pink-400" />
              )}
            </button>

            {data.playerNickname && (
              <span className="rounded-md bg-pink-100 px-2 py-0.5 font-bold text-pink-700">
                {data.playerNickname}
              </span>
            )}

            <span className="text-gray-300">|</span>
            <span className="font-mono text-xs font-semibold text-gray-500">
              #{data.orderNumber}
            </span>
          </div>
        </div>

        {/* ── 1. COMPLETED & EXPIRED RECEIPT VIEW ── */}
        {isCompleted ? (
          <div className="rounded-3xl border-2 border-amber-400/80 bg-gradient-to-b from-white via-amber-50/30 to-white p-6 sm:p-12 text-center shadow-2xl shadow-amber-200/40 relative overflow-hidden animate-fade-in">
            {/* Top gold shine accent */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />

            {/* Victory Badge */}
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 text-purple-950 shadow-xl shadow-amber-300/60 ring-8 ring-amber-100 mb-5 animate-bounce overflow-hidden p-3.5">
              {wonRewardImage ? (
                <img src={wonRewardImage} alt={prizeLabel} className="w-full h-full object-contain" />
              ) : (
                <Trophy className="h-12 w-12 text-purple-950" />
              )}
            </div>

            {/* Expired / Single Use Tag */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-black uppercase text-amber-900 border border-amber-300">
              <span>🔒</span>
              <span>បានប្រើប្រាស់រួចរាល់ (EXPIRED - 1/1 USE)</span>
            </div>

            <h2 className="mt-3 font-display text-2xl sm:text-4xl font-black text-gray-900">
              Diamond ត្រូវបានបញ្ចូលជោគជ័យ!
            </h2>

            <p className="mt-2 text-xs sm:text-sm font-bold text-emerald-700 max-w-lg mx-auto">
              ✅ ពេជ្រត្រូវបានបញ្ចូលទៅក្នុងគណនីហ្គេមរបស់អ្នកដោយស្វ័យប្រវត្តរួចរាល់ហើយ។
            </p>

            <div className="mt-1 text-xs font-medium text-gray-500">
              កងបង្វិលលើការបញ្ជាទិញនេះត្រូវបានប្រើប្រាស់រួចរាល់ មិនអាចបង្វិលបានទៀតឡើយ។
            </div>

            {/* Main Reward Card */}
            <div className="my-7 mx-auto max-w-md rounded-3xl border-2 border-amber-300/80 bg-gradient-to-b from-amber-500/10 via-white to-amber-500/5 p-6 sm:p-8 shadow-lg relative">
              {wonRewardImage ? (
                <div className="mb-3 flex justify-center">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-amber-300/80 bg-white/95 shadow-md flex items-center justify-center p-2.5 overflow-hidden">
                    <img
                      src={wonRewardImage}
                      alt={prizeLabel}
                      className="w-full h-full object-contain drop-shadow-sm"
                    />
                  </div>
                </div>
              ) : (
                <span className="text-4xl sm:text-5xl block mb-2">💎</span>
              )}
              <p className="text-xs font-black uppercase tracking-wider text-amber-700">
                រង្វាន់ដែលអ្នកទទួលបាន
              </p>
              <p className="mt-1 font-display text-3xl sm:text-5xl font-black text-pink-600 drop-shadow-sm">
                {prizeLabel}
              </p>

              {/* Receipt Breakdown Table */}
              <div className="mt-6 border-t border-amber-200/80 pt-4 text-left space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-500">ហ្គេម (Game)</span>
                  <span className="font-bold text-gray-900">{data.game.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-500">កញ្ចប់ (Package)</span>
                  <span className="font-bold text-gray-900">{data.package.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-500">ឈ្មោះអ្នកលេង (Player Name)</span>
                  <span className="font-bold text-pink-600">{data.playerNickname || "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-500">Player ID (UID)</span>
                  <span className="font-mono font-black text-pink-700">
                    {data.playerUid} {data.serverId ? `(${data.serverId})` : ""}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-500">ស្ថានភាពបញ្ជូន</span>
                  <span className="inline-flex items-center gap-1 font-black text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> ជោគជ័យ (DELIVERED)
                  </span>
                </div>
                {data.fulfillmentRef && (
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-500">លេខយោង (Ref)</span>
                    <span className="font-mono text-gray-700">{data.fulfillmentRef}</span>
                  </div>
                )}
                {data.claimedAt && (
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-500">កាលបរិច្ឆេទ</span>
                    <span className="text-gray-600">
                      {new Date(data.claimedAt).toLocaleString("km-KH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Navigation Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-pink-300 bg-white px-6 py-4 text-xs sm:text-sm font-black text-pink-700 shadow-sm transition-all hover:bg-pink-50 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>🏠 ត្រឡប់ទៅទំព័រដើម</span>
              </Link>
              <Link
                href={`/order?number=${data.orderNumber}`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-6 py-4 text-xs sm:text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                <span>📋 ពិនិត្យវិក្កយបត្រ</span>
              </Link>
              <Link
                href={`/games/${data.game.slug}`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 px-6 py-4 text-xs sm:text-sm font-black text-white shadow-xl shadow-pink-300/40 transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>🎡 បង្វិលកងថ្មី</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          /* ── 2. ACTIVE LUCKY WHEEL INTERACTIVE VIEW ── */
          <div className="flex flex-col items-center">
            {/* The Lucky Wheel */}
            <div className="my-3 scale-95 sm:scale-100 transition-transform">
              <LuckyWheel
                slots={data.slots}
                onSpinStart={handleSpinStart}
                onSpinEnd={handleSpinEnd}
                isSpinning={spinning}
                disabled={spinning || isCompleted}
                targetIndex={targetIndex}
                size={360}
              />
            </div>

            {/* Spin Trigger Button */}
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={handleSpinStart}
                disabled={spinning || isCompleted}
                className={`group relative inline-flex items-center justify-center gap-3 rounded-2xl px-10 py-4 font-black text-sm sm:text-base text-white shadow-2xl transition-all duration-300 active:scale-95 ${
                  spinning
                    ? "bg-gray-500 cursor-not-allowed shadow-none"
                    : "bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 shadow-pink-500/40 hover:shadow-pink-500/60 hover:scale-105"
                }`}
              >
                {spinning ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>កំពុងបង្វិលកង់សំណាង...</span>
                  </>
                ) : (
                  <>
                    <span className="text-xl">🎡</span>
                    <span>ចុចដើម្បីបង្វិលកង់ (SPIN NOW)</span>
                    <Sparkles className="h-4 w-4 text-amber-300 group-hover:rotate-12 transition-transform" />
                  </>
                )}
              </button>

              <p className="mt-2.5 text-xs font-semibold text-pink-600/90">
                🔒 ១ ការបញ្ជាទិញ = ១ សិទ្ធិបង្វិល (ប្រព័ន្ធនឹងផ្ញើរង្វាន់ពេជ្រចូលគណនីហ្គេមដោយស្វ័យប្រវត្តិ)
              </p>
            </div>
          </div>
        )}

        {/* ── 3. CELEBRATION WIN MODAL WITH AUTOMATIC API CLAIM ── */}
        {showWinModal && wonSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-yellow-400 bg-gradient-to-b from-[#1c0e35] via-[#120824] to-[#1c0e35] p-6 sm:p-8 text-center text-white shadow-[0_20px_70px_rgba(234,179,8,0.35)] animate-scale-up">
              {/* Ambient gold glow */}
              <div className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-yellow-400/30 blur-3xl" />

              {/* Sparkle / Reward Icon (Configured from Admin Panel) */}
              <div className="mx-auto flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-3xl bg-gradient-to-tr from-yellow-400 via-amber-300 to-yellow-500 text-purple-950 shadow-2xl shadow-yellow-400/60 ring-8 ring-yellow-400/20 mb-4 animate-bounce overflow-hidden p-3 bg-white/95">
                {wonRewardImage ? (
                  <img
                    src={wonRewardImage}
                    alt={wonSlot.label}
                    className="w-full h-full object-contain drop-shadow-md"
                  />
                ) : (
                  <Sparkles className="h-12 w-12 text-purple-950" />
                )}
              </div>

              <span className="rounded-full bg-yellow-400/20 px-3.5 py-1 text-xs font-black uppercase text-yellow-300 border border-yellow-400/40">
                🎉 CONGRATULATIONS!
              </span>

              <h2 className="mt-3 font-display text-2xl sm:text-3xl font-black text-white drop-shadow">
                អបអរសាទរ! អ្នកបានឈ្នះ
              </h2>

              {/* Won Reward Card */}
              <div className="my-5 overflow-hidden rounded-2xl border border-yellow-400/50 bg-gradient-to-b from-white/[0.12] via-white/[0.06] to-white/[0.03] p-5 backdrop-blur-md shadow-2xl text-center relative">
                {/* Top gold shine accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500" />

                {/* Won Reward Highlight */}
                <div className="mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-yellow-400/20 border border-yellow-400/40 text-[11px] font-black uppercase text-yellow-300 tracking-wider">
                    <Sparkles className="h-3 w-3 text-yellow-300" />
                    រង្វាន់ឈ្នះ (Won Reward)
                  </span>
                  <p className="mt-2 text-3xl sm:text-4xl font-black bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-400 bg-clip-text text-transparent drop-shadow-[0_2px_14px_rgba(251,191,36,0.5)]">
                    {wonSlot.label}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-white/70">
                    ឱកាសឈ្នះ: <span className="text-yellow-300 font-bold">{wonSlot.probability}%</span> · Game: <span className="text-white font-bold">{data.game.name}</span>
                  </p>
                </div>

                {/* Info Card: Name package, player name, player id */}
                <div className="border-t border-white/10 pt-3 space-y-2 text-left text-xs">
                  {/* 1. Name Package */}
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.06] px-3.5 py-2.5 border border-white/10 hover:border-yellow-400/30 transition-colors">
                    <div className="flex items-center gap-2 text-amber-200/90 font-semibold text-xs">
                      <div className="w-6 h-6 rounded-lg bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
                        <Package className="h-3.5 w-3.5" />
                      </div>
                      <span>Package:</span>
                    </div>
                    <div className="text-right flex items-center gap-1.5 truncate">
                      <span className="font-black text-white text-xs sm:text-sm truncate">
                        {data.package.name}
                      </span>
                      {data.package.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/30 text-pink-200 border border-pink-400/30 font-bold shrink-0">
                          {data.package.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 2. Player Name */}
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.06] px-3.5 py-2.5 border border-white/10 hover:border-pink-400/30 transition-colors">
                    <div className="flex items-center gap-2 text-pink-200/90 font-semibold text-xs">
                      <div className="w-6 h-6 rounded-lg bg-pink-400/20 border border-pink-400/30 flex items-center justify-center text-pink-300 shrink-0">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <span>Player Name:</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-pink-300 text-xs sm:text-sm">
                        {data.playerNickname || "—"}
                      </span>
                    </div>
                  </div>

                  {/* 3. Player ID (UID) */}
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.06] px-3.5 py-2.5 border border-white/10 hover:border-cyan-400/30 transition-colors">
                    <div className="flex items-center gap-2 text-cyan-200/90 font-semibold text-xs">
                      <div className="w-6 h-6 rounded-lg bg-cyan-400/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shrink-0">
                        <Gamepad2 className="h-3.5 w-3.5" />
                      </div>
                      <span>Player ID:</span>
                    </div>
                    <div className="text-right font-mono font-black text-cyan-200 text-xs sm:text-sm flex items-center gap-1.5">
                      <span>{data.playerUid}</span>
                      {data.serverId && (
                        <span className="text-cyan-400/70 text-[11px] font-normal">({data.serverId})</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ⚡ AUTOMATIC DELIVERY STATUS (NO CLAIM BUTTON NEEDED) */}
              {claiming && (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 mb-2 flex items-center justify-center gap-3 text-amber-200">
                  <Loader2 className="h-5 w-5 animate-spin text-yellow-400 shrink-0" />
                  <div className="text-left text-xs font-bold leading-tight">
                    <p className="text-yellow-300">កំពុងផ្ញើរង្វាន់ពេជ្រដោយស្វ័យប្រវត្តិ...</p>
                    <p className="text-[11px] text-white/70 font-normal">
                      បញ្ចូលត្រង់ទៅកាន់ UID: {data.playerUid}
                    </p>
                  </div>
                </div>
              )}

              {claimSuccess && (
                <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/20 p-4 mb-2 flex items-center justify-center gap-3 text-emerald-200 animate-scale-up">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                  <div className="text-left text-xs font-bold leading-tight">
                    <p className="text-emerald-300">បានផ្ញើរង្វាន់ពេជ្រជោគជ័យ!</p>
                    <p className="text-[11px] text-emerald-100/80 font-normal">
                      ពេជ្រត្រូវបានបញ្ចូលទៅក្នុងគណនីរបស់អ្នករួចរាល់
                    </p>
                  </div>
                </div>
              )}

              {claimError && (
                <div className="mb-4">
                  <div className="rounded-xl border border-red-500/50 bg-red-500/20 p-3 text-xs text-red-200 font-bold mb-3">
                    {claimError}
                  </div>
                  <button
                    type="button"
                    onClick={() => executeAutoClaim(wonSlot)}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 py-3.5 text-xs font-black uppercase text-purple-950 shadow-lg hover:brightness-110 active:scale-95"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>ព្យាយាមផ្ញើរង្វាន់ម្តងទៀត (Retry Delivery)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
