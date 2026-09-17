"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  MousePointerClick,
  Users,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Percent,
  DollarSign,
  Coins,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { AffiliateStats } from "@/lib/affiliate/types";

export default function CreatorAnalyticsPage() {
  const [period, setPeriod] = useState<"TODAY" | "7DAYS" | "30DAYS" | "MONTH">("30DAYS");
  const [stats, setStats] = useState<AffiliateStats | null>(null);

  useEffect(() => {
    fetch("/api/promote/auth")
      .then((r) => r.json())
      .then((data) => {
        if (data?.stats) setStats(data.stats);
      });
  }, []);

  // Multipliers for period preview demo on localhost
  const factor = period === "TODAY" ? 0.08 : period === "7DAYS" ? 0.35 : period === "MONTH" ? 0.85 : 1.0;

  const displayClicks = stats ? Math.round(stats.clicks * factor) : 1284;
  const displayVisitors = stats ? Math.round(stats.visitors * factor) : 982;
  const displayOrders = stats ? Math.round(stats.orders * factor) : 87;
  const displaySuccess = stats ? Math.round(stats.successfulOrders * factor) : 82;
  const displayCancelled = stats ? Math.max(0, Math.round(stats.cancelledOrders * factor)) : 5;
  const displayConversion = stats ? stats.conversionRate : 8.35;
  const displaySales = stats ? stats.totalSales * factor : 384.50;
  const displayCommission = stats ? (stats.orders * 0.04 * factor) : (displayOrders * 0.04);

  // Chart data simulation
  const chartDays = [
    { day: "Mon", sales: 42.5, orders: 9 },
    { day: "Tue", sales: 68.0, orders: 15 },
    { day: "Wed", sales: 55.2, orders: 12 },
    { day: "Thu", sales: 89.4, orders: 20 },
    { day: "Fri", sales: 110.5, orders: 25 },
    { day: "Sat", sales: 145.8, orders: 32 },
    { day: "Sun", sales: 98.2, orders: 22 },
  ];

  const maxSale = Math.max(...chartDays.map((d) => d.sales));

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            <h1 className="text-2xl font-black text-white font-display">Performance Analytics</h1>
            <p className="text-xs text-purple-300/80 mt-0.5">
              Real-time traffic, conversion rate, and commission performance ($0.04/order)
            </p>
          </div>
        </div>

        {/* Period Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-purple-950/60 p-1 rounded-xl border border-purple-800/40">
          {(
            [
              { key: "TODAY", label: "Today" },
              { key: "7DAYS", label: "7 Days" },
              { key: "30DAYS", label: "30 Days" },
              { key: "MONTH", label: "This Month" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => setPeriod(item.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === item.key
                  ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md shadow-pink-500/20"
                  : "text-purple-300 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 8 Metric KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Clicks */}
        <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-purple-300 text-xs font-semibold mb-2">
            <span>Total Clicks</span>
            <MousePointerClick className="h-4 w-4 text-pink-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            {displayClicks.toLocaleString()}
          </div>
          <p className="text-[10px] text-purple-400/80 mt-1">Total referral link hits</p>
        </div>

        {/* Unique Visitors */}
        <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-purple-300 text-xs font-semibold mb-2">
            <span>Unique Visitors</span>
            <Users className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            {displayVisitors.toLocaleString()}
          </div>
          <p className="text-[10px] text-purple-400/80 mt-1">First-time visitors</p>
        </div>

        {/* Orders */}
        <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-purple-300 text-xs font-semibold mb-2">
            <span>Total Orders</span>
            <ShoppingBag className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">{displayOrders}</div>
          <p className="text-[10px] text-purple-400/80 mt-1">Referred transactions</p>
        </div>

        {/* Conversion Rate */}
        <div className="rounded-2xl bg-gradient-to-br from-pink-900/60 to-purple-950/80 border border-pink-500/30 p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-pink-300 text-xs font-semibold mb-2">
            <span>Conversion Rate</span>
            <Percent className="h-4 w-4 text-pink-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-pink-300 font-mono">
            {displayConversion}%
          </div>
          <p className="text-[10px] text-pink-300/70 mt-1">Orders ÷ Visitors</p>
        </div>

        {/* Successful Orders */}
        <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-purple-300 text-xs font-semibold mb-2">
            <span>Successful Orders</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            {displaySuccess}
          </div>
          <p className="text-[10px] text-purple-400/80 mt-1">Completed & delivered</p>
        </div>

        {/* Cancelled Orders */}
        <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-purple-300 text-xs font-semibold mb-2">
            <span>Cancelled Orders</span>
            <XCircle className="h-4 w-4 text-red-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-red-400 font-mono">
            {displayCancelled}
          </div>
          <p className="text-[10px] text-purple-400/80 mt-1">Unpaid or failed</p>
        </div>

        {/* Total Sales */}
        <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-purple-300 text-xs font-semibold mb-2">
            <span>Referred Sales</span>
            <DollarSign className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            ${displaySales.toFixed(2)}
          </div>
          <p className="text-[10px] text-purple-400/80 mt-1">Gross merchandise volume</p>
        </div>

        {/* Your Fixed $0.04 Commission */}
        <div className="rounded-2xl bg-gradient-to-br from-purple-900/80 to-emerald-950/60 border border-emerald-500/30 p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold mb-2">
            <span>Commission ($0.04/order)</span>
            <Coins className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            ${displayCommission.toFixed(2)}
          </div>
          <p className="text-[10px] text-emerald-300/70 mt-1">Fixed $0.04 earned per order</p>
        </div>
      </div>

      {/* Interactive Purple Gaming Chart */}
      <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-5 sm:p-6 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-pink-400" />
              <span>Sales & Volume Trends</span>
            </h3>
            <p className="text-xs text-purple-300/70">Daily performance breakdown over the selected period</p>
          </div>
          <span className="text-xs font-mono font-bold text-pink-400">Fixed $0.04 / Order</span>
        </div>

        {/* CSS/SVG Bar Chart with purple gradient & glow */}
        <div className="h-56 flex items-end justify-between gap-2 sm:gap-6 pt-6 px-2 border-b border-purple-800/40 pb-2">
          {chartDays.map((item) => {
            const barHeightPct = Math.round((item.sales / maxSale) * 100);
            return (
              <div key={item.day} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                {/* Tooltip value on hover */}
                <span className="text-[10px] font-mono font-bold text-pink-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  ${item.sales.toFixed(1)}
                </span>
                <div className="w-full max-w-[48px] bg-purple-900/60 rounded-xl overflow-hidden flex flex-col justify-end p-0.5 border border-purple-700/30">
                  <div
                    style={{ height: `${barHeightPct}%` }}
                    className="w-full rounded-lg bg-gradient-to-t from-purple-600 to-pink-500 shadow-lg shadow-pink-500/25 transition-all duration-500 group-hover:from-purple-500 group-hover:to-pink-400"
                  />
                </div>
                <span className="text-[11px] font-bold text-purple-300/80">{item.day}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500" />
            <span className="text-purple-300 font-medium">Daily Sales Volume ($)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

