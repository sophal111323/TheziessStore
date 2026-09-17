"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, Clock, Wallet, CheckCircle2, ArrowRight } from "lucide-react";
import { AffiliateStats, AffiliateOrder } from "@/lib/affiliate/types";

export default function CreatorEarningsPage() {
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [orders, setOrders] = useState<AffiliateOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/promote/auth").then((r) => r.json()),
      fetch("/api/promote/orders").then((r) => r.json()),
    ]).then(([authData, ordersData]) => {
      if (authData?.stats) setStats(authData.stats);
      if (Array.isArray(ordersData)) setOrders(ordersData);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white font-display">Earnings Breakdown</h1>
          <p className="text-xs text-purple-300/80 mt-0.5">
            Transparent revenue tracking across all referred sales
          </p>
        </div>
      </div>

      {/* 4 Financial Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Earnings */}
        <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-4 sm:p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-purple-300 text-xs font-semibold mb-2">
            <span>Total Earnings</span>
            <Coins className="h-4 w-4 text-pink-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            ${stats ? stats.totalCommission.toFixed(2) : "0.00"}
          </div>
          <p className="text-[10px] text-purple-400/80 mt-1">Lifetime commission generated</p>
        </div>

        {/* Pending */}
        <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-4 sm:p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-purple-300 text-xs font-semibold mb-2">
            <span>Pending</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
            ${stats ? stats.pendingCommission.toFixed(2) : "0.00"}
          </div>
          <p className="text-[10px] text-purple-400/80 mt-1">Pending order fulfillment</p>
        </div>

        {/* Available */}
        <div className="rounded-2xl bg-gradient-to-br from-purple-900/80 to-emerald-950/70 border border-emerald-500/40 p-4 sm:p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold mb-2">
            <span>Available Balance</span>
            <Wallet className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            ${stats ? stats.availableBalance.toFixed(2) : "0.00"}
          </div>
          <p className="text-[10px] text-emerald-300/80 mt-1">Ready for withdrawal</p>
        </div>

        {/* Paid */}
        <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-4 sm:p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-purple-300 text-xs font-semibold mb-2">
            <span>Paid Out</span>
            <CheckCircle2 className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            ${stats ? stats.paidCommission.toFixed(2) : "0.00"}
          </div>
          <p className="text-[10px] text-purple-400/80 mt-1">Transferred to bank</p>
        </div>
      </div>

      {/* Earnings History Table */}
      <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 overflow-hidden shadow-xl backdrop-blur-md">
        <div className="p-5 border-b border-purple-800/40">
          <h3 className="text-base font-bold text-white font-display">Earnings History</h3>
          <p className="text-xs text-purple-300/70">Detailed per-order commission record</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-purple-900/40 text-purple-300/80 uppercase tracking-wider text-[10px] border-b border-purple-800/40">
              <tr>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Order</th>
                <th className="px-5 py-3.5">Game</th>
                <th className="px-5 py-3.5 text-right">Sale Amount</th>
                <th className="px-5 py-3.5 text-right">Commission (5%)</th>
                <th className="px-5 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-800/30">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-purple-400">
                    Loading earnings…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-purple-400">
                    No earnings history yet.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-purple-900/30 transition-colors">
                    <td className="px-5 py-3.5 text-purple-300/80">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 font-mono font-bold text-pink-300">{o.orderNumber}</td>
                    <td className="px-5 py-3.5 font-medium text-white">{o.gameName}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-purple-200">
                      ${o.amountUsd.toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-400">
                      +${o.commissionUsd.toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                          o.status === "COMPLETED"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

