"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Gift,
  Sparkles,
  Trophy,
  Copy,
  Check,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Lock,
  Tag,
  ShieldCheck,
  Flame,
  Heart,
} from "lucide-react";

interface SlotInfo {
  slotNumber: number;
  color?: string;
  icon?: string;
}

interface ClaimInfo {
  slotNumber: number;
  rewardType: string;
  rewardTitle: string;
  promoCode?: string | null;
  diamondAmount?: number | null;
  claimedAt: string;
}

interface RevealedSlot {
  slotNumber: number;
  rewardType: string;
  rewardTitle: string;
}

interface GiftPageData {
  orderNumber: string;
  orderStatus: string;
  isPaid: boolean;
  playerUid?: string;
  productName?: string;
  gameName?: string;
  eventEnabled: boolean;
  alreadyClaimed: boolean;
  claim?: ClaimInfo | null;
  boxes: SlotInfo[];
}

export default function GiftBoxClient({ orderNumber }: { orderNumber: string }) {
  const [data, setData] = useState<GiftPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction & animation states
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [shakingSlot, setShakingSlot] = useState<number | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [revealedBoxes, setRevealedBoxes] = useState<RevealedSlot[]>([]);
  const [wonPrize, setWonPrize] = useState<ClaimInfo | null>(null);
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Double click guard ref
  const openingLockRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fetch initial gift data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/gift/${encodeURIComponent(orderNumber)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "មិនអាចទាញយកទិន្នន័យកាដូបានទេ");
      }

      let isPaid = Boolean(json.isPaid ?? json.order?.isPaid);
      const cleanOrderNum = json.orderNumber || json.order?.orderNumber || orderNumber;

      // If not marked paid yet, attempt quick auto-sync from payment gateway
      if (!isPaid) {
        try {
          const syncRes = await fetch(`/api/orders/${encodeURIComponent(cleanOrderNum)}/sync-payment`, {
            method: "POST",
            cache: "no-store",
          });
          const syncJson = await syncRes.json();
          if (syncJson?.status === "PAID" || syncJson?.status === "PROCESSING" || syncJson?.status === "DELIVERED") {
            isPaid = true;
          }
        } catch {
          // silent sync error
        }
      }

      const normalizedData: GiftPageData = {
        orderNumber: cleanOrderNum,
        orderStatus: json.orderStatus || json.order?.status || "",
        isPaid,
        playerUid: json.playerUid || json.order?.playerUid,
        productName: json.productName || json.order?.productName,
        gameName: json.gameName || json.order?.gameName,
        eventEnabled: json.eventEnabled !== false,
        alreadyClaimed: Boolean(json.alreadyClaimed),
        claim: json.claim || null,
        boxes: json.boxes || json.slots || [],
      };

      setData(normalizedData);

      if (json.alreadyClaimed && json.claim) {
        setWonPrize(json.claim);
        setSelectedSlot(json.claim.slotNumber);
      }
    } catch (err: any) {
      setError(err.message || "មានបញ្ហាបច្ចេកទេស សូមព្យាយាមម្តងទៀត");
    } finally {
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Particle / Confetti burst
  const triggerConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#a855f7", "#ec4899", "#f59e0b", "#38bdf8", "#fbbf24", "#ffffff"];
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      rotation: number;
      vRot: number;
    }> = [];

    const centerX = canvas.width / 2;
    const centerY = canvas.height * 0.45;

    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 12 + 4;
      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10,
      });
    }

    let animationId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // gravity
        p.vx *= 0.98; // friction
        p.alpha -= 0.008;
        p.rotation += p.vRot;

        if (p.alpha > 0) {
          alive++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      }

      if (alive > 0) {
        animationId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    render();
  }, []);

  // Handle Box Click (Airtight Anti-Double Click)
  const handleOpenBox = async (slotNumber: number) => {
    // 1. Strict guard against multi clicks, ongoing requests, or already claimed
    if (openingLockRef.current || isOpening || data?.alreadyClaimed || wonPrize) {
      return;
    }

    openingLockRef.current = true;
    setIsOpening(true);
    setSelectedSlot(slotNumber);
    setShakingSlot(slotNumber);

    try {
      // 2. Play tension delay for dramatic effect
      await new Promise((resolve) => setTimeout(resolve, 800));

      const res = await fetch(`/api/gift/${encodeURIComponent(orderNumber)}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotNumber }),
      });

      const result = await res.json();

      if (!res.ok) {
        setShakingSlot(null);
        if (result.alreadyClaimed && result.claim) {
          setData((prev) => (prev ? { ...prev, alreadyClaimed: true, claim: result.claim } : prev));
          setWonPrize(result.claim);
        }
        throw new Error(result.error || "មិនអាចបើកកាដូបានទេ");
      }

      // Successful reveal
      setShakingSlot(null);
      const claimObj = result.claim || {};
      const winSlot = result.winningSlot || {};
      const resolvedPrize: ClaimInfo = {
        slotNumber: claimObj.slotNumber || winSlot.slotNumber || slotNumber,
        rewardType: claimObj.rewardType || winSlot.rewardType || "CUSTOM",
        rewardTitle: claimObj.rewardTitle || winSlot.rewardTitle || winSlot.label || "រង្វាន់កាដូ",
        promoCode: claimObj.promoCode || claimObj.promoCodeStr || winSlot.promoCodeStr,
        diamondAmount: claimObj.diamondAmount ?? claimObj.rewardAmount ?? winSlot.rewardAmount,
        claimedAt: claimObj.claimedAt || new Date().toISOString(),
      };
      setWonPrize(resolvedPrize);
      if (result.revealedBoxes) {
        setRevealedBoxes(result.revealedBoxes);
      }
      setData((prev) => (prev ? { ...prev, alreadyClaimed: true, claim: resolvedPrize } : prev));

      // Trigger sparkles & confetti
      triggerConfetti();

      // Show winning celebration modal after reveal animation
      setTimeout(() => {
        setShowPrizeModal(true);
      }, 700);
    } catch (err: any) {
      setError(err.message || "មានបញ្ហាពេលបើកកាដូ");
      openingLockRef.current = false;
      setIsOpening(false);
    }
  };

  const copyPromoCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // fallback
    }
  };

  // ── Render Loading ──
  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-purple-500/20 border-t-purple-500" />
          <Gift className="absolute inset-0 m-auto h-7 w-7 text-purple-400 animate-pulse" />
        </div>
        <p className="mt-4 text-sm font-medium text-purple-300/80 animate-pulse">
          កំពុងរៀបចំប្រអប់កាដូសំណាង...
        </p>
      </div>
    );
  }

  // ── Render Error ──
  if (error && !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 shadow-lg shadow-red-500/10">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">មិនអាចបើកកាដូបានទេ</h2>
        <p className="text-sm text-purple-200/70 mb-6">{error}</p>
        <Link
          href={`/order?number=${encodeURIComponent(orderNumber)}`}
          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          ត្រឡប់ទៅមើលការបញ្ជាទិញ
        </Link>
      </div>
    );
  }

  // ── Unpaid Order Notice ──
  if (data && !data.isPaid) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-lg shadow-amber-500/10">
          <Lock className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">ត្រូវការទូទាត់ប្រាក់ជាមុនសិន</h2>
        <p className="text-sm text-purple-200/70 mb-6">
          ដើម្បីទទួលបានសិទ្ធិចាប់កាដូសំណាង 1 លើក សូមបញ្ចប់ការទូទាត់សម្រាប់ Order #{data.orderNumber} ជាមុនសិន។
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/checkout/${encodeURIComponent(orderNumber)}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500 transition-all"
          >
            ទៅទូទាត់ប្រាក់ឥឡូវនេះ
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-purple-500/30 px-5 py-3 text-sm font-medium text-purple-200 hover:bg-purple-500/10 transition-colors"
          >
            ទំព័រដើម
          </Link>
        </div>
      </div>
    );
  }

  // ── Event Closed Notice ──
  if (data && !data.eventEnabled && !data.alreadyClaimed) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <Gift className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">កម្មវិធីចាប់កាដូត្រូវបានបិទជាបណ្ដោះអាសន្ន</h2>
        <p className="text-sm text-purple-200/70 mb-6">
          Admin បានបិទ Event ចាប់កាដូនេះជាបណ្តោះអាសន្ន។ សូមរង់ចាំការបើកឡើងវិញ ឬទាក់ទងមកកាន់ Page / Telegram Admin។
        </p>
        <Link
          href={`/order?number=${encodeURIComponent(orderNumber)}`}
          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          ត្រឡប់ទៅមើលការបញ្ជាទិញ
        </Link>
      </div>
    );
  }

  const isCompleted = Boolean(data?.alreadyClaimed || wonPrize);

  return (
    <div className="relative overflow-hidden px-4 py-8 sm:py-12">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-purple-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/2 -left-40 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-[100px]" />
      <div className="pointer-events-none absolute top-1/2 -right-40 h-80 w-80 rounded-full bg-indigo-600/15 blur-[100px]" />

      {/* Confetti Canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-50 h-full w-full"
      />

      <div className="mx-auto max-w-3xl">
        {/* Navigation & Order Badge */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/order?number=${encodeURIComponent(orderNumber)}`}
            className="inline-flex items-center gap-2 rounded-xl border border-purple-500/20 bg-purple-950/40 px-3.5 py-2 text-xs font-semibold text-purple-300 hover:bg-purple-900/40 hover:text-white transition-all backdrop-blur-md"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>ការបញ្ជាទិញ #{orderNumber}</span>
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-900/40 px-3.5 py-1 text-xs font-semibold text-purple-200 backdrop-blur-md shadow-inner">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>ការទូទាត់ជោគជ័យ • 1 Order = 1 កាដូ</span>
          </div>
        </div>

        {/* Header Section */}
        <div className="mb-8 text-center sm:mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 border border-purple-400/30 px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-purple-300 shadow-md shadow-purple-950/40 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-yellow-400 animate-spin" style={{ animationDuration: "6s" }} />
            <span>MYSTERY PURPLE GIFT EVENT</span>
          </div>

          <h1 className="font-display text-2xl sm:text-4xl font-black tracking-tight text-white drop-shadow-sm">
            ចាប់កាដូសំណាង <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-300">9 ប្រអប់</span>
          </h1>

          <p className="mt-2 text-xs sm:text-sm text-purple-200/70 max-w-lg mx-auto">
            {isCompleted
              ? "អ្នកបានបើកកាដូសំណាងរួចរាល់ហើយ! សូមពិនិត្យមើលរង្វាន់ដែលទទួលបានខាងក្រោម"
              : "សូមជ្រើសរើសប្រអប់កាដូពណ៌ស្វាយមួយដែលអ្នកពេញចិត្ត ដើម្បីទទួលយករង្វាន់ពិសេសភ្លាមៗ!"}
          </p>

          {/* Quick status bar */}
          <div className="mt-4 flex items-center justify-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {isCompleted ? "បានបើកកាដូរួច" : "មានសិទ្ធិបើក 1 លើក"}
            </span>
            {data?.productName && (
              <span className="text-purple-300/80 bg-purple-900/30 border border-purple-800/40 px-3 py-1 rounded-full truncate max-w-[200px]">
                {data.productName}
              </span>
            )}
          </div>
        </div>

        {/* ── ALREADY WON BANNER ── */}
        {isCompleted && wonPrize && (
          <div className="mb-8 rounded-3xl border-2 border-purple-400/40 bg-gradient-to-b from-purple-900/50 via-purple-950/70 to-purple-900/40 p-5 sm:p-6 shadow-2xl shadow-purple-950/60 backdrop-blur-xl animate-fade-in">
            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              <div className={`relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg border-2 ${
                wonPrize.rewardType === "THANK_YOU"
                  ? "bg-gradient-to-tr from-pink-600 to-purple-600 shadow-pink-500/30 border-pink-400/40"
                  : "bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 shadow-purple-500/30 border-purple-300/30"
              }`}>
                {wonPrize.rewardType === "THANK_YOU" ? (
                  <Heart className="h-10 w-10 text-white fill-white animate-pulse" />
                ) : (
                  <Trophy className="h-10 w-10 text-yellow-300 animate-bounce" />
                )}
                <span className={`absolute -top-2 -right-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase shadow ${
                  wonPrize.rewardType === "THANK_YOU"
                    ? "bg-pink-400 text-purple-950"
                    : "bg-yellow-400 text-purple-950"
                }`}>
                  {wonPrize.rewardType === "THANK_YOU" ? "Thanks" : "Won!"}
                </span>
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="rounded-full bg-purple-400/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-400/30">
                    ប្រអប់លេខ #{wonPrize.slotNumber}
                  </span>
                  <span className="text-xs text-purple-300/60">
                    {new Date(wonPrize.claimedAt).toLocaleTimeString()}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  {wonPrize.rewardTitle}
                </h3>
                <p className="text-xs text-purple-200/80">
                  {wonPrize.rewardType === "PROMO_CODE"
                    ? "លោកអ្នកអាចប្រើកូដគូប៉ុងនេះដើម្បីបញ្ចុះតម្លៃលើការទិញលើកក្រោយ"
                    : wonPrize.rewardType === "DIAMOND"
                    ? `ទទួលបាន ${wonPrize.diamondAmount || 0} ពេជ្រដោយឥតគិតថ្លៃ!`
                    : wonPrize.rewardType === "THANK_YOU"
                    ? "អរគុណច្រើនសម្រាប់ការគាំទ្រ Theziess Store! សូមព្យាយាមផ្សងសំណាងម្តងទៀតនៅការកុម្ម៉ង់បន្ទាប់ 🥰"
                    : "រង្វាន់ពិសេសពី TheziessStore ត្រូវបានកត់ត្រាចូលក្នុងប្រព័ន្ធរួចរាល់!"}
                </p>
              </div>

              {/* Promo code copy box if applicable */}
              {wonPrize.promoCode && (
                <div className="w-full sm:w-auto shrink-0 flex items-center justify-between gap-3 rounded-2xl bg-purple-950/80 border border-purple-400/40 p-2.5 px-4 shadow-inner">
                  <div>
                    <div className="text-[10px] font-semibold text-purple-300/70">PROMO CODE</div>
                    <div className="font-mono text-base font-black tracking-wider text-yellow-300">
                      {wonPrize.promoCode}
                    </div>
                  </div>
                  <button
                    onClick={() => copyPromoCode(wonPrize.promoCode!)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:from-purple-500 hover:to-indigo-500 active:scale-95 transition-all"
                  >
                    {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedCode ? "ចម្លងរួច" : "Copy"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 9 MYSTERY BOXES GRID (3x3) ── */}
        <div className="relative rounded-3xl border border-purple-500/20 bg-gradient-to-b from-[#140727]/90 via-[#100520]/80 to-[#180830]/90 p-4 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-3 gap-3 sm:gap-6">
            {Array.from({ length: 9 }).map((_, idx) => {
              const slotNum = idx + 1;
              const isSelected = selectedSlot === slotNum;
              const isShaking = shakingSlot === slotNum;
              const isClaimedWinningBox = wonPrize?.slotNumber === slotNum;
              const revealedInfo = revealedBoxes.find((b) => b.slotNumber === slotNum);

              return (
                <div
                  key={slotNum}
                  onClick={() => !isCompleted && !isOpening && handleOpenBox(slotNum)}
                  className={`group relative flex aspect-square flex-col items-center justify-center rounded-2xl sm:rounded-3xl p-2 sm:p-4 transition-all duration-300 select-none ${
                    isCompleted
                      ? isClaimedWinningBox
                        ? "border-2 border-yellow-400/80 bg-gradient-to-b from-purple-800/80 to-purple-950 shadow-2xl shadow-yellow-500/20 scale-[1.03]"
                        : "border border-purple-500/20 bg-purple-950/30 opacity-70 cursor-default"
                      : isOpening
                      ? isSelected
                        ? "border-2 border-purple-400 bg-purple-900/60 scale-[1.04] shadow-xl shadow-purple-500/30 cursor-wait"
                        : "border border-purple-500/20 bg-purple-950/40 opacity-50 pointer-events-none cursor-not-allowed"
                      : "cursor-pointer border-2 border-purple-500/30 bg-gradient-to-b from-purple-900/40 via-purple-950/60 to-[#1e0a38]/80 hover:border-purple-400/80 hover:from-purple-800/60 hover:to-purple-900/80 hover:shadow-xl hover:shadow-purple-500/25 hover:-translate-y-1 active:scale-95"
                  } ${isShaking ? "animate-bounce" : ""}`}
                >
                  {/* Slot Number Badge */}
                  <span
                    className={`absolute top-2 left-2 sm:top-3 sm:left-3 flex h-5 w-5 sm:h-7 sm:w-7 items-center justify-center rounded-full text-[10px] sm:text-xs font-black shadow-md transition-colors ${
                      isClaimedWinningBox
                        ? "bg-yellow-400 text-purple-950 shadow-yellow-400/50"
                        : "bg-purple-900/80 border border-purple-400/30 text-purple-200"
                    }`}
                  >
                    #{slotNum}
                  </span>

                  {/* Winning box ribbon indicator */}
                  {isClaimedWinningBox && (
                    <span className={`absolute top-2 right-2 sm:top-3 sm:right-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-black ${
                      wonPrize?.rewardType === "THANK_YOU"
                        ? "bg-pink-500/20 border border-pink-500/40 text-pink-300"
                        : "bg-yellow-400/20 border border-yellow-400/40 text-yellow-300"
                    }`}>
                      {wonPrize?.rewardType === "THANK_YOU" ? (
                        <>
                          <Heart className="h-3 w-3 text-pink-400 fill-pink-400" />
                          <span>THANKS</span>
                        </>
                      ) : (
                        <>
                          <Trophy className="h-3 w-3 text-yellow-400" />
                          <span>WON</span>
                        </>
                      )}
                    </span>
                  )}

                  {/* ── Box Icon & Visual Art ── */}
                  <div className="relative my-auto flex flex-col items-center justify-center">
                    {/* Glowing backlight */}
                    <div
                      className={`absolute inset-0 -m-4 rounded-full blur-xl transition-opacity ${
                        isClaimedWinningBox
                          ? wonPrize?.rewardType === "THANK_YOU"
                            ? "bg-pink-500/30 opacity-100"
                            : "bg-yellow-400/25 opacity-100"
                          : isSelected
                          ? "bg-purple-500/30 opacity-100"
                          : "bg-purple-500/0 group-hover:bg-purple-500/20 opacity-0 group-hover:opacity-100"
                      }`}
                    />

                    {/* 3D Purple Gift Box Graphic */}
                    {isCompleted && isClaimedWinningBox ? (
                      /* Opened prize icon */
                      <div className="flex flex-col items-center animate-scale-in">
                        <div className={`flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl shadow-lg ${
                          wonPrize?.rewardType === "THANK_YOU"
                            ? "bg-gradient-to-tr from-pink-500 to-purple-600 text-white shadow-pink-500/30 border border-pink-400/30"
                            : "bg-gradient-to-tr from-yellow-400 to-amber-500 text-purple-950 shadow-yellow-400/30"
                        }`}>
                          {wonPrize?.rewardType === "THANK_YOU" ? (
                            <Heart className="h-7 w-7 sm:h-9 sm:w-9 text-white fill-white" />
                          ) : (
                            <Trophy className="h-7 w-7 sm:h-9 sm:w-9 text-purple-950" />
                          )}
                        </div>
                        <span className={`mt-2 text-center text-[10px] sm:text-xs font-black line-clamp-1 max-w-[90px] sm:max-w-[120px] ${
                          wonPrize?.rewardType === "THANK_YOU" ? "text-pink-300" : "text-yellow-300"
                        }`}>
                          {wonPrize?.rewardTitle}
                        </span>
                      </div>
                    ) : isCompleted && revealedInfo ? (
                      /* Other revealed box info */
                      <div className="flex flex-col items-center opacity-70">
                        <Gift className="h-8 w-8 sm:h-12 sm:w-12 text-purple-400/60" />
                        <span className="mt-1 text-center text-[9px] sm:text-[11px] font-medium text-purple-300/60 line-clamp-1 max-w-[85px] sm:max-w-[110px]">
                          {revealedInfo.rewardTitle}
                        </span>
                      </div>
                    ) : (
                      /* Unopened Mystery Box */
                      <div className="relative flex flex-col items-center">
                        {isOpening && isSelected ? (
                          <div className="flex flex-col items-center">
                            <Loader2 className="h-10 w-10 sm:h-14 sm:w-14 animate-spin text-purple-400" />
                            <span className="mt-2 text-[10px] font-bold text-purple-300 animate-pulse">
                              កំពុងបើក...
                            </span>
                          </div>
                        ) : (
                          <>
                            {/* Stylized Gift Icon with Gold Ribbon Accent */}
                            <div className="relative group-hover:scale-110 transition-transform duration-300">
                              <Gift className="h-10 w-10 sm:h-16 sm:w-16 text-purple-400 drop-shadow-[0_4px_10px_rgba(168,85,247,0.4)]" />
                              <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 sm:h-5 sm:w-5 text-yellow-400 animate-pulse" />
                            </div>

                            <span className="mt-1 text-[10px] sm:text-xs font-bold text-purple-200/90 group-hover:text-white transition-colors">
                              កាដូ #{slotNum}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Hint */}
                  {!isCompleted && !isOpening && (
                    <span className="text-[9px] sm:text-[11px] font-semibold text-purple-400/70 group-hover:text-yellow-300 transition-colors">
                      ចុចដើម្បីបើក ✨
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Double-Click Protection & Security Tag */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-purple-500/20 pt-4 text-xs text-purple-300/60">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-purple-400" />
              <span>ប្រព័ន្ធការពារ Double-Click & Auto-Verification</span>
            </div>
            <div className="flex items-center gap-1">
              <Flame className="h-4 w-4 text-orange-400" />
              <span>រង្វាន់ត្រូវបានផ្តល់ជូនភ្លាមៗ (Instant Claim)</span>
            </div>
          </div>
        </div>

        {/* ── RETURN BUTTONS ── */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={`/order?number=${encodeURIComponent(orderNumber)}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-900/60 border border-purple-500/30 px-6 py-3.5 text-sm font-bold text-white hover:bg-purple-800/60 transition-all shadow-lg shadow-purple-950/40"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>ពិនិត្យមើលការបញ្ជាទិញ (Track Order)</span>
          </Link>

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500 transition-all"
          >
            <span>ទិញទំនិញបន្ថែម (Back to Store)</span>
          </Link>
        </div>
      </div>

      {/* ── PRIZE CELEBRATION MODAL ── */}
      {showPrizeModal && wonPrize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-purple-400/60 bg-gradient-to-b from-[#1c0836] via-[#120524] to-[#1a0733] p-6 text-center shadow-2xl shadow-purple-500/30 animate-scale-in">
            {/* Top glowing orb */}
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-fuchsia-500/30 blur-3xl" />

            {/* Confetti icon badge */}
            <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl text-white shadow-xl border-2 border-white/20 animate-bounce ${
              wonPrize.rewardType === "THANK_YOU"
                ? "bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 shadow-pink-500/40"
                : "bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 shadow-purple-500/40"
            }`}>
              {wonPrize.rewardType === "THANK_YOU" ? (
                <Heart className="h-10 w-10 text-white fill-white" />
              ) : (
                <Trophy className="h-10 w-10 text-yellow-300" />
              )}
            </div>

            <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black mb-2 ${
              wonPrize.rewardType === "THANK_YOU"
                ? "bg-pink-400/20 border border-pink-400/40 text-pink-300"
                : "bg-yellow-400/20 border border-yellow-400/40 text-yellow-300"
            }`}>
              <Sparkles className="h-3.5 w-3.5" />
              <span>{wonPrize.rewardType === "THANK_YOU" ? "🙏 សូមអរគុណ! THANK YOU!" : "✨ អបអរសាទរ! CONGRATULATIONS!"}</span>
            </div>

            <h2 className={`font-display text-2xl font-black mb-2 ${
              wonPrize.rewardType === "THANK_YOU" ? "text-pink-200" : "text-white"
            }`}>
              {wonPrize.rewardTitle}
            </h2>

            <p className="text-xs sm:text-sm text-purple-200/80 mb-6">
              {wonPrize.rewardType === "THANK_YOU"
                ? "អរគុណច្រើនសម្រាប់ការគាំទ្រ Theziess Store! សូមព្យាយាមផ្សងសំណាងម្តងទៀតនៅការកុម្ម៉ង់បន្ទាប់ 🥰"
                : wonPrize.rewardType === "PROMO_CODE"
                ? "អ្នកបានបើកចំកូដគូប៉ុងបញ្ចុះតម្លៃពិសេស! សូមចម្លងលេខកូដខាងក្រោមដើម្បីប្រើប្រាស់៖"
                : wonPrize.rewardType === "DIAMOND"
                ? `អ្នកទទួលបាន ${wonPrize.diamondAmount || 0} ពេជ្រឥតគិតថ្លៃសម្រាប់ Order នេះ!`
                : "អ្នកបានបើកទទួលបានរង្វាន់កាដូសំណាងដោយជោគជ័យ!"}
            </p>

            {/* Promo Code Display with 1-click Copy */}
            {wonPrize.promoCode && (
              <div className="mb-6 rounded-2xl border-2 border-dashed border-yellow-400/60 bg-purple-950/90 p-4">
                <div className="text-[11px] font-bold text-purple-300 uppercase tracking-wider mb-1">
                  លេខកូដគូប៉ុង (Promo Code)
                </div>
                <div className="font-mono text-2xl font-black tracking-widest text-yellow-300 select-all mb-3">
                  {wonPrize.promoCode}
                </div>
                <button
                  onClick={() => copyPromoCode(wonPrize.promoCode!)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-2.5 text-xs font-black text-purple-950 shadow-lg shadow-yellow-500/20 hover:from-yellow-300 hover:to-amber-400 transition-all cursor-pointer"
                >
                  {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copiedCode ? "បានចម្លងរួចរាល់! (Copied)" : "ចម្លងលេខកូដ (Copy Code)"}</span>
                </button>
              </div>
            )}

            {/* Close / Action Button */}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => setShowPrizeModal(false)}
                className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3.5 text-sm font-black text-white shadow-xl shadow-purple-500/25 hover:from-purple-500 hover:to-indigo-500 transition-all"
              >
                យល់ព្រម (Awesome!)
              </button>
              <Link
                href={`/order?number=${encodeURIComponent(orderNumber)}`}
                className="text-xs text-purple-300/70 hover:text-white py-1 transition-colors"
              >
                ត្រឡប់ទៅការបញ្ជាទិញ
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
