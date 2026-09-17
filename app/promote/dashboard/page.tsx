"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  ShoppingBag,
  DollarSign,
  Coins,
  Clock,
  Wallet,
  Copy,
  Check,
  Share2,
  QrCode,
  ArrowUpRight,
  TrendingUp,
  X,
} from "lucide-react";
import { Affiliate, AffiliateStats, AffiliateOrder } from "@/lib/affiliate/types";

export default function CreatorDashboardPage() {
  const [creator, setCreator] = useState<Affiliate | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<AffiliateOrder[]>([]);
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [origin, setOrigin] = useState("http://localhost:3000");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }

    fetch("/api/promote/auth")
      .then((r) => r.json())
      .then((data) => {
        if (data?.authenticated) {
          setCreator(data.creator);
          setStats(data.stats);
        }
      });

    fetch("/api/promote/orders")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRecentOrders(data.slice(0, 5));
        }
      })
      .catch(() => {});
  }, []);

  const referralUrl = creator ? `${origin}/${creator.slug}` : `${origin}/davin`;

  function handleCopy() {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "TheziessStore Top Up",
          text: "Top up game with the best rate on TheziessStore!",
          url: referralUrl,
        });
      } catch {}
    } else {
      handleCopy();
    }
  }

  return (
    <div className="space-y-6">
      {/* ── REFERRAL LINK HERO CARD ─────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900 via-pink-900 to-indigo-950 p-6 sm:p-8 border border-pink-500/30 shadow-2xl shadow-purple-950/60">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-pink-500/20 blur-3xl" />

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-pink-400">
                Your Exclusive Referral Link
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white font-display mt-0.5">
                Share & Earn 5% Commission
              </h2>
            </div>
            <span className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              Active 5% Commission
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 flex items-center bg-purple-950/70 border border-purple-600/40 rounded-2xl px-4 py-3 text-sm font-mono text-pink-300 select-all overflow-x-auto">
              <span className="truncate">{referralUrl}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-pink-500 hover:bg-pink-600 px-4 py-3 text-xs font-extrabold text-white shadow-lg shadow-pink-500/30 transition-all active:scale-95"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? "Link copied!" : "Copy Link"}</span>
              </button>

              <button
                onClick={handleShare}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-800/60 hover:bg-purple-700/60 px-3.5 py-3 text-xs font-bold text-white border border-purple-500/30 transition-all active:scale-95"
                title="Share"
              >
                <Share2 className="h-4 w-4" />
              </button>

              <button
                onClick={() => setShowQrModal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-800/60 hover:bg-purple-700/60 px-3.5 py-3 text-xs font-bold text-white border border-purple-500/30 transition-all active:scale-95"
                title="QR Code"
              >
                <QrCode className="h-4 w-4" />
              </button>
            </div>
          </div>

          {copied && (
            <p className="text-xs text-emerald-400 font-bold mt-2 animate-fade-in">
              ✓ Link copied to clipboard! Share it with your community.
            </p>
          )}
        </div>
      </div>

      {/* ── 6 SUMMARY METRIC CARDS ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* 1. Visitors */}
        <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-4 sm:p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-purple-300 text-xs font-semibold mb-2">
            <span>Visitors</span>
            <Users className="h-4 w-4 text-pink-400" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-white font-mono">
            {stats ? stats.visitors.toLocaleString() : "0"}
          </div>
          <p className="text-[11px] text-purple-300/70 mt-1">Unique visitors via link</p>
        </div>

        {/* 2. Orders */}
        <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-4 sm:p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-purple-300 text-xs font-semibold mb-2">
            <span>Orders</span>
            <ShoppingBag className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-white font-mono">
            {stats ? stats.orders : 0}
          </div>
          <p className="text-[11px] text-purple-300/70 mt-1">Total referred orders</p>
        </div>

        {/* 3. Total Sales */}
        <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-4 sm:p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-purple-300 text-xs font-semibold mb-2">
            <span>Total Sales</span>
            <DollarSign className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-white font-mono">
            ${stats ? stats.totalSales.toFixed(2) : "0.00"}
          </div>
          <p className="text-[11px] text-purple-300/70 mt-1">Gross merchandise volume</p>
        </div>

        {/* 4. Total Commission */}
        <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-4 sm:p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-purple-300 text-xs font-semibold mb-2">
            <span>Total Commission</span>
            <Coins className="h-4 w-4 text-pink-400" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-pink-400 font-mono">
            ${stats ? stats.totalCommission.toFixed(2) : "0.00"}
          </div>
          <p className="text-[11px] text-purple-300/70 mt-1">$0.04 per successful order</p>
        </div>

        {/* 5. Pending Commission */}
        <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-4 sm:p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-purple-300 text-xs font-semibold mb-2">
            <span>Pending</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-amber-400 font-mono">
            ${stats ? stats.pendingCommission.toFixed(2) : "0.00"}
          </div>
          <p className="text-[11px] text-purple-300/70 mt-1">Awaiting order delivery</p>
        </div>

        {/* 6. Available Balance */}
        <div className="rounded-2xl bg-gradient-to-br from-purple-900/80 to-pink-900/60 border border-pink-500/40 p-4 sm:p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-pink-300 text-xs font-semibold mb-2">
            <span>Available Balance</span>
            <Wallet className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-emerald-400 font-mono">
            ${stats ? stats.availableBalance.toFixed(2) : "0.00"}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <Link
              href="/promote/earnings"
              className="text-xs font-bold text-white hover:text-pink-300 underline inline-flex items-center gap-1"
            >
              <span>View Earnings</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── RECENT ORDERS OVERVIEW ───────────────────────────────────── */}
      <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-5 sm:p-6 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white font-display">Recent Referred Orders</h3>
            <p className="text-xs text-purple-300/70">Orders generated from your custom referral link</p>
          </div>
          <Link
            href="/promote/orders"
            className="text-xs font-bold text-pink-400 hover:text-pink-300 inline-flex items-center gap-1"
          >
            <span>View all</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-purple-300/70 uppercase tracking-wider border-b border-purple-800/40 text-[10px]">
              <tr>
                <th className="pb-3">Order #</th>
                <th className="pb-3">Game</th>
                <th className="pb-3">Product</th>
                <th className="pb-3 text-right">Amount</th>
                <th className="pb-3 text-right">Your 5%</th>
                <th className="pb-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-800/30">
              {recentOrders.map((o) => (
                <tr key={o.id} className="hover:bg-purple-900/30 transition-colors">
                  <td className="py-3 font-mono font-bold text-pink-300">{o.orderNumber}</td>
                  <td className="py-3 font-medium text-white">{o.gameName}</td>
                  <td className="py-3 text-purple-200">{o.productName}</td>
                  <td className="py-3 text-right font-mono text-purple-200">${o.amountUsd.toFixed(2)}</td>
                  <td className="py-3 text-right font-mono font-bold text-emerald-400">
                    +${o.commissionUsd.toFixed(2)}
                  </td>
                  <td className="py-3 text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                        o.status === "COMPLETED"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : o.status === "PENDING"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-red-500/20 text-red-300 border border-red-500/30"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── QR CODE MODAL ───────────────────────────────────────────── */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-purple-950 border border-purple-700/50 p-6 shadow-2xl text-center relative animate-scale-in">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 text-purple-400 hover:text-white rounded-full hover:bg-purple-900/50"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-white font-display">Your Referral QR Code</h3>
            <p className="text-xs text-purple-300/80 mt-1 mb-4">
              Gamers can scan this code to buy directly from your storefront!
            </p>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mb-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  referralUrl
                )}`}
                alt="Referral QR Code"
                className="h-48 w-48 mx-auto"
              />
            </div>

            <p className="text-[11px] font-mono text-pink-300 break-all mb-4">{referralUrl}</p>

            <button
              onClick={handleCopy}
              className="w-full rounded-xl bg-pink-500 hover:bg-pink-600 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-pink-500/30"
            >
              {copied ? "Link copied!" : "Copy Referral Link"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

