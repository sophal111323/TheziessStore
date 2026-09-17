"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ShoppingBag, Search, Filter, Calendar, ShieldAlert } from "lucide-react";
import { AffiliateOrder } from "@/lib/affiliate/types";

export default function CreatorOrdersPage() {
  const [orders, setOrders] = useState<AffiliateOrder[]>([]);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/promote/orders?status=${status}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setOrders(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status]);

  const filteredOrders = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.gameName.toLowerCase().includes(q) ||
      o.productName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-black/40 border border-purple-500/30 p-2 shadow-inner flex items-center justify-center shrink-0">
            <Image
              src="/theziessstore-logo-transparent.png"
              alt="Theziess Store Logo"
              width={38}
              height={38}
              className="object-contain drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white font-display">Referred Orders</h1>
              <span className="rounded-full border border-purple-400/40 bg-purple-500/20 px-2.5 py-0.5 text-[11px] font-bold text-purple-200 font-mono">
                $0.04 / Order
              </span>
            </div>
            <p className="text-xs text-purple-300/80 mt-0.5">
              Only orders completed through your personal referral link appear here.
            </p>
          </div>
        </div>

        {/* Security badge */}
        <div className="inline-flex items-center gap-1.5 rounded-xl bg-purple-900/40 border border-purple-700/40 px-3 py-1.5 text-xs text-purple-300 shrink-0">
          <ShieldAlert className="h-3.5 w-3.5 text-pink-400" />
          <span>Customer PII Protected</span>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 bg-purple-950/60 p-1 rounded-xl border border-purple-800/40 overflow-x-auto">
          {["ALL", "COMPLETED", "PENDING", "CANCELLED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                status === s
                  ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/20"
                  : "text-purple-300 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400" />
          <input
            type="text"
            placeholder="Search order #, game, or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-purple-950/60 border border-purple-800/40 text-xs text-white placeholder-purple-400/50 focus:border-pink-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Orders Table Card */}
      <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 overflow-hidden shadow-xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-purple-900/40 text-purple-300/80 uppercase tracking-wider text-[10px] border-b border-purple-800/40">
              <tr>
                <th className="px-5 py-3.5">Order Number</th>
                <th className="px-5 py-3.5">Game</th>
                <th className="px-5 py-3.5">Package</th>
                <th className="px-5 py-3.5 text-right">Order Total</th>
                <th className="px-5 py-3.5 text-right">Your Commission ($0.04)</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-800/30">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-purple-400">
                    Loading orders…
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-purple-400">
                    <ShoppingBag className="h-8 w-8 mx-auto text-purple-500 mb-2 opacity-50" />
                    <p className="font-bold text-white">No orders found</p>
                    <p className="text-xs text-purple-400/80 mt-1">Share your link to start generating orders!</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-purple-900/30 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-pink-300">{o.orderNumber}</td>
                    <td className="px-5 py-3.5 font-medium text-white">{o.gameName}</td>
                    <td className="px-5 py-3.5 text-purple-200">{o.productName}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-purple-200">${o.amountUsd.toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-400">
                      +${o.commissionUsd.toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
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
                    <td className="px-5 py-3.5 text-right text-[11px] text-purple-300/70">
                      {new Date(o.createdAt).toLocaleDateString()}
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

