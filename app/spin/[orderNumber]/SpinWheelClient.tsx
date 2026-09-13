"use client";

import React, { useState, useEffect, useCallback } from "react";
import LuckyWheel, { WheelSlot } from "@/components/LuckyWheel";
import Link from "next/link";
import { Loader2, Sparkles, CheckCircle2, ArrowRight, ShieldCheck, Gift, AlertCircle } from "lucide-react";

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

  // Fetch spin state
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/spin/${encodeURIComponent(orderNumber)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load spin details");
      }
      setData(json);

      // If already spun but not yet claimed, set wonSlot
      if (json.status === "SPUN" && json.winningSlotId) {
        const found = json.slots.find((s: WheelSlot) => s.id === json.winningSlotId);
        if (found) {
          setWonSlot(found);
          setShowWinModal(true);
        }
      } else if (json.status === "COMPLETED") {
        setClaimSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Execute Spin
  const handleSpinStart = async () => {
    if (spinning || !data || data.status === "COMPLETED") return;

    try {
      setSpinning(true);
      setError(null);
      const res = await fetch(`/api/spin/${encodeURIComponent(orderNumber)}/spin`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to execute spin");
      }

      // Set target index returned from server-side cryptographic outcome
      setTargetIndex(json.winningIndex);
    } catch (err: any) {
      setSpinning(false);
      setError(err.message || "Spin failed");
    }
  };

  // Wheel animation complete
  const handleSpinEnd = (slot: WheelSlot) => {
    setSpinning(false);
    setWonSlot(slot);
    setShowWinModal(true);
  };

  // Claim Reward
  const handleClaim = async () => {
    if (claiming || !data) return;

    try {
      setClaiming(true);
      setClaimError(null);
      const res = await fetch(`/api/spin/${encodeURIComponent(orderNumber)}/claim`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to claim reward");
      }

      setClaimSuccess(true);
      setShowWinModal(false);
      await loadData();
    } catch (err: any) {
      setClaimError(err.message || "Failed to claim");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-9 w-9 animate-spin text-pink-500" />
        <p className="text-sm font-bold text-pink-700">កំពុងរៀបចំកង់សំណាង...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500 mb-3" />
          <h2 className="text-lg font-black text-red-900">មិនអាចបង្វិលកង់បានទេ</h2>
          <p className="mt-2 text-sm text-red-700">{error || "រកមិនឃើញការបញ្ជាទិញនេះឡើយ"}</p>
          <div className="mt-5 flex gap-3 justify-center">
            <Link
              href="/"
              className="rounded-xl border border-pink-300 bg-white px-5 py-2.5 text-xs font-black text-pink-700 hover:bg-pink-50"
            >
              ត្រឡប់ទៅទំព័រដើម
            </Link>
            <Link
              href={`/checkout/${orderNumber}`}
              className="rounded-xl bg-pink-600 px-5 py-2.5 text-xs font-black text-white hover:bg-pink-700"
            >
              ពិនិត្យការទូទាត់
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isCompleted = data.status === "COMPLETED" || claimSuccess;

  return (
    <div className="relative mx-auto max-w-4xl px-4 py-8 sm:py-12 sm:px-6">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-pink-400/20 blur-3xl" />

      {/* Header Info */}
      <div className="text-center mb-8 relative z-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-pink-300/80 bg-pink-50/90 px-4 py-1.5 text-xs font-black text-pink-700 shadow-sm">
          <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
          <span>{data.package.badge || "🔥 MYSTERY BOX"}</span>
        </div>

        <h1 className="mt-3 font-display text-2xl sm:text-4xl font-black tracking-tight text-pink-950">
          {data.package.name}
        </h1>

        <p className="mt-1.5 text-xs sm:text-sm font-bold text-pink-600">
          បង្វិលកង់សំណាងដើម្បីឈ្នះរង្វាន់ Diamonds ធំៗ!
        </p>

        {/* Player Identity Pill */}
        <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-pink-200 bg-white/90 px-4 py-2 text-xs shadow-sm">
          <span className="font-semibold text-gray-500">{data.game.name}:</span>
          <span className="font-mono font-black text-pink-800">
            UID {data.playerUid}
            {data.serverId ? ` (${data.serverId})` : ""}
          </span>
          {data.playerNickname && (
            <span className="rounded-md bg-pink-100 px-2 py-0.5 font-bold text-pink-700">
              {data.playerNickname}
            </span>
          )}
          <span className="text-gray-300">|</span>
          <span className="font-mono text-gray-400">#{data.orderNumber}</span>
        </div>
      </div>

      {/* Main Wheel Section or Claimed Receipt */}
      {isCompleted ? (
        <div className="rounded-3xl border-2 border-emerald-300 bg-gradient-to-b from-white via-emerald-50/40 to-white p-8 sm:p-12 text-center shadow-xl relative overflow-hidden">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50 mb-5">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase text-emerald-800">
            COMPLETED & DELIVERED
          </span>

          <h2 className="mt-3 font-display text-2xl sm:text-3xl font-black text-emerald-950">
            Diamond ត្រូវបានបញ្ចូលជោគជ័យ!
          </h2>

          <div className="my-6 inline-block rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">រង្វាន់ដែលបានឈ្នះ</p>
            <p className="mt-1 font-display text-3xl font-black text-pink-600">
              {data.winningRewardLabel || (wonSlot ? wonSlot.label : "Diamond Reward")}
            </p>
            <p className="mt-2 text-xs font-semibold text-gray-600">
              គណនីហ្គេម UID: <span className="font-mono font-bold text-gray-900">{data.playerUid}</span>
            </p>
            {data.fulfillmentRef && (
              <p className="mt-1 font-mono text-[11px] text-gray-400">Ref: {data.fulfillmentRef}</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="rounded-2xl border-2 border-pink-300 bg-white px-6 py-3.5 text-xs sm:text-sm font-black text-pink-700 shadow-sm transition-all hover:bg-pink-50"
            >
              ត្រឡប់ទៅទំព័រដើម
            </Link>
            <Link
              href={`/order?number=${data.orderNumber}`}
              className="rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 px-6 py-3.5 text-xs sm:text-sm font-black text-white shadow-md shadow-pink-300/40 transition-all hover:brightness-110"
            >
              តាមដានការបញ្ជាទិញ
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {/* Wheel Component */}
          <div className="my-4">
            <LuckyWheel
              slots={data.slots}
              onSpinStart={handleSpinStart}
              onSpinEnd={handleSpinEnd}
              isSpinning={spinning}
              disabled={spinning || data.status === "COMPLETED"}
              targetIndex={targetIndex}
              size={360}
            />
          </div>

          {/* Spin instruction button */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleSpinStart}
              disabled={spinning}
              className={`rounded-2xl px-8 py-4 font-black text-sm sm:text-base text-white shadow-xl transition-all duration-300 active:scale-95 ${
                spinning
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-pink-600 via-fuchsia-600 to-purple-600 shadow-pink-400/50 hover:shadow-pink-400/70 hover:scale-105"
              }`}
            >
              {spinning ? "កំពុងបង្វិលកង់..." : "🎡 ចុចដើម្បីបង្វិលកង់ (SPIN NOW)"}
            </button>
            <p className="mt-2 text-xs font-semibold text-pink-600/80">
              ១ ការបញ្ជាទិញ = ១ សិទ្ធិបង្វិល (ការពារដោយប្រព័ន្ធសុវត្ថិភាព Cryptographic RNG)
            </p>
          </div>

          {/* Probability & Rewards Breakdown Table */}
          <div className="mt-12 w-full max-w-xl rounded-3xl border border-pink-200/80 bg-white/95 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-pink-100 pb-3">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-pink-900 flex items-center gap-2">
                <Gift className="h-4 w-4 text-pink-500" />
                តារាងរង្វាន់ និងឱកាសឈ្នះ (Winning Probability)
              </h3>
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> 100% Fair Odds
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {data.slots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center gap-2.5 rounded-xl border border-pink-100 p-2.5 transition-all hover:border-pink-300 hover:shadow-sm"
                  style={{ borderLeftColor: slot.color, borderLeftWidth: 4 }}
                >
                  <span className="text-xl">{slot.icon || "💎"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-gray-900">{slot.label}</p>
                    <p className="text-[11px] font-bold text-pink-600">{slot.probability}% Chance</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Celebration Win Modal ── */}
      {showWinModal && wonSlot && !isCompleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-yellow-400 bg-gradient-to-b from-purple-950 via-gray-900 to-purple-950 p-6 sm:p-8 text-center text-white shadow-[0_20px_60px_rgba(234,179,8,0.3)] animate-scale-up">
            {/* Ambient gold glow */}
            <div className="pointer-events-none absolute -top-16 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-yellow-400/30 blur-3xl" />

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-yellow-400 via-amber-300 to-yellow-500 text-purple-950 shadow-lg shadow-yellow-400/50 ring-4 ring-yellow-200/50 mb-4 animate-bounce">
              <Sparkles className="h-10 w-10" />
            </div>

            <span className="rounded-full bg-yellow-400/20 px-3 py-1 text-xs font-black uppercase text-yellow-300 border border-yellow-400/30">
              CONGRATULATIONS!
            </span>

            <h2 className="mt-3 font-display text-2xl sm:text-3xl font-black text-white drop-shadow">
              អបអរសាទរ! អ្នកបានឈ្នះ
            </h2>

            <div className="my-5 rounded-2xl border border-yellow-400/40 bg-white/10 p-5 backdrop-blur-md">
              <p className="text-3xl sm:text-4xl font-black text-yellow-300 drop-shadow">
                {wonSlot.label}
              </p>
              <p className="mt-1 text-xs font-bold text-white/70">
                ឱកាសឈ្នះ: {wonSlot.probability}% · Game: {data.game.name}
              </p>
              <p className="mt-2 text-xs font-mono font-semibold text-pink-300">
                UID: {data.playerUid}
              </p>
            </div>

            {claimError && (
              <div className="mb-4 rounded-xl border border-red-500/50 bg-red-500/20 p-3 text-xs text-red-200 font-bold">
                {claimError}
              </div>
            )}

            <button
              type="button"
              disabled={claiming}
              onClick={handleClaim}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 py-4 text-sm sm:text-base font-black uppercase text-purple-950 shadow-xl shadow-yellow-500/40 transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-75"
            >
              {claiming ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>កំពុងផ្ញើ Diamonds ចូលគណនី...</span>
                </>
              ) : (
                <>
                  <span>🎁 ទទួលយករង្វាន់ឥឡូវនេះ (CLAIM REWARD)</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

