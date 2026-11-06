"use client";

import React, { useState, useEffect } from "react";
import { useTelegram } from "@/components/tma/TelegramProvider";
import {
  Gamepad2,
  Package,
  User,
  HelpCircle,
  Zap,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";

type ActiveTab = "home" | "games" | "orders" | "account" | "faq";

// Mock Data for Step 3
const MOCK_GAMES = [
  {
    id: "freefire",
    name: "Free Fire",
    publisher: "Garena",
    icon: "🔥",
    currency: "Diamonds",
    popularBadge: "HOT 🔥",
    packages: ["100 💎", "310 💎", "520 💎", "1,060 💎", "2,180 💎"],
    gradient: "from-amber-500/20 to-orange-500/20",
    border: "border-orange-500/30",
  },
  {
    id: "mlbb",
    name: "Mobile Legends",
    publisher: "Moonton",
    icon: "⚔️",
    currency: "Diamonds",
    popularBadge: "POPULAR",
    packages: ["86 💎", "172 💎", "257 💎", "706 💎", "2,195 💎"],
    gradient: "from-blue-500/20 to-purple-500/20",
    border: "border-blue-500/30",
  },
  {
    id: "pubg",
    name: "PUBG Mobile",
    publisher: "Tencent",
    icon: "🪖",
    currency: "Unknown Cash (UC)",
    popularBadge: "FAST",
    packages: ["60 UC", "325 UC", "660 UC", "1,800 UC"],
    gradient: "from-emerald-500/20 to-teal-500/20",
    border: "border-emerald-500/30",
  },
  {
    id: "roblox",
    name: "Roblox",
    publisher: "Roblox Corp",
    icon: "🧱",
    currency: "Robux",
    popularBadge: "INSTANT",
    packages: ["80 R$", "400 R$", "800 R$", "1,700 R$"],
    gradient: "from-red-500/20 to-rose-500/20",
    border: "border-red-500/30",
  },
];

const MOCK_ORDERS = [
  {
    orderNumber: "TS-94821034",
    game: "Free Fire",
    package: "720 Diamonds",
    price: "$4.99",
    status: "SUCCESS",
    date: "Just now",
  },
  {
    orderNumber: "TS-83910214",
    game: "Mobile Legends",
    package: "344 Diamonds",
    price: "$2.99",
    status: "PROCESSING",
    date: "10 mins ago",
  },
  {
    orderNumber: "TS-72910395",
    game: "Roblox",
    package: "800 Robux",
    price: "$9.99",
    status: "PENDING_PAYMENT",
    date: "1 hour ago",
  },
];

const MOCK_FAQS = [
  {
    q: "How fast is top-up delivery?",
    a: "Top-up is processed automatically within 30 to 60 seconds after your payment is confirmed.",
  },
  {
    q: "Do you need my game password?",
    a: "Never! We only need your Player ID (and Server ID if applicable). Your account remains 100% secure.",
  },
  {
    q: "What payment methods are supported?",
    a: "We support Bakong KHQR, ABA Mobile, Wing Bank, and all major local mobile banking apps.",
  },
  {
    q: "How can I contact customer support?",
    a: "Our customer support team is available 24/7 directly via Telegram support.",
  },
];

export default function TelegramMiniApp() {
  const { isReady, isTelegram, user, triggerHaptic } = useTelegram();
  const [activeTab, setActiveTab] = useState<ActiveTab>("home");
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Sync Telegram BackButton with active modal/tab
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.BackButton) return;

    if (activeTab !== "home" || selectedGame) {
      tg.BackButton.show();
      const handleBack = () => {
        triggerHaptic("light");
        if (selectedGame) {
          setSelectedGame(null);
        } else {
          setActiveTab("home");
        }
      };
      tg.BackButton.onClick(handleBack);
      return () => {
        tg.BackButton.offClick(handleBack);
      };
    } else {
      tg.BackButton.hide();
    }
  }, [activeTab, selectedGame, triggerHaptic]);

  const handleTabChange = (tab: ActiveTab) => {
    triggerHaptic("light");
    setActiveTab(tab);
    setSelectedGame(null);
  };

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(String(user.id));
      setCopiedId(true);
      triggerHaptic("success");
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto pb-24 select-none">
      {/* ── TOP APP HEADER ── */}
      <header className="sticky top-0 z-30 px-5 pt-4 pb-3 bg-[#0d0517]/90 backdrop-blur-md border-b border-purple-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-pulse">💜</span>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5 font-display">
                TheziessStore
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  TMA
                </span>
              </h1>
              <p className="text-xs text-purple-300/80 font-medium">
                {user?.first_name ? `Hi, ${user.first_name}! 👋` : "Fast Game Top-Up"}
              </p>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/60 border border-purple-800/40 text-[11px] font-medium">
            <span
              className={`w-2 h-2 rounded-full ${
                isTelegram ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-amber-400"
              }`}
            />
            <span className="text-slate-300">{isTelegram ? "Telegram" : "Web Preview"}</span>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 px-4 pt-4 space-y-5">
        {/* HERO BANNER CARD */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-900/60 via-purple-950/80 to-[#120724] border border-purple-500/30 p-5 shadow-lg shadow-purple-950/50">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 rounded-full bg-purple-600/20 blur-2xl pointer-events-none" />
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              Official Telegram Top-Up Store
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight leading-snug">
              💜 TheziessStore
            </h2>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-semibold text-purple-200">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                ⚡ Game Top-Up
              </span>
              <span className="text-purple-600">•</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                🔐 Secure & Fast
              </span>
            </div>
          </div>
        </section>

        {/* ── 4 MAIN NAVIGATION CARDS ── */}
        <section className="grid grid-cols-2 gap-3">
          {/* CARD 1: GAMES */}
          <button
            onClick={() => handleTabChange("games")}
            className={`p-4 rounded-xl text-left transition-all duration-200 border flex flex-col justify-between h-28 relative overflow-hidden group ${
              activeTab === "games"
                ? "bg-purple-900/50 border-purple-400 shadow-md shadow-purple-900/40"
                : "bg-purple-950/30 hover:bg-purple-900/30 border-purple-800/30"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-lg">
                🎮
              </div>
              <ChevronRight className="w-4 h-4 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">🎮 Games</h3>
              <p className="text-[11px] text-purple-300/80">Diamonds & UC</p>
            </div>
          </button>

          {/* CARD 2: MY ORDERS */}
          <button
            onClick={() => handleTabChange("orders")}
            className={`p-4 rounded-xl text-left transition-all duration-200 border flex flex-col justify-between h-28 relative overflow-hidden group ${
              activeTab === "orders"
                ? "bg-purple-900/50 border-purple-400 shadow-md shadow-purple-900/40"
                : "bg-purple-950/30 hover:bg-purple-900/30 border-purple-800/30"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-lg bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-lg">
                📦
              </div>
              <ChevronRight className="w-4 h-4 text-pink-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">📦 My Orders</h3>
              <p className="text-[11px] text-purple-300/80">Track Status</p>
            </div>
          </button>

          {/* CARD 3: ACCOUNT */}
          <button
            onClick={() => handleTabChange("account")}
            className={`p-4 rounded-xl text-left transition-all duration-200 border flex flex-col justify-between h-28 relative overflow-hidden group ${
              activeTab === "account"
                ? "bg-purple-900/50 border-purple-400 shadow-md shadow-purple-900/40"
                : "bg-purple-950/30 hover:bg-purple-900/30 border-purple-800/30"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-lg">
                👤
              </div>
              <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">👤 Account</h3>
              <p className="text-[11px] text-purple-300/80">
                {user?.username ? `@${user.username}` : "Telegram User"}
              </p>
            </div>
          </button>

          {/* CARD 4: FAQ */}
          <button
            onClick={() => handleTabChange("faq")}
            className={`p-4 rounded-xl text-left transition-all duration-200 border flex flex-col justify-between h-28 relative overflow-hidden group ${
              activeTab === "faq"
                ? "bg-purple-900/50 border-purple-400 shadow-md shadow-purple-900/40"
                : "bg-purple-950/30 hover:bg-purple-900/30 border-purple-800/30"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-lg">
                ❓
              </div>
              <ChevronRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">❓ FAQ</h3>
              <p className="text-[11px] text-purple-300/80">Help & Support</p>
            </div>
          </button>
        </section>

        {/* ── CARD DETAIL VIEWS (MOCK DATA) ── */}
        <section className="space-y-4">
          {/* VIEW: GAMES */}
          {(activeTab === "games" || activeTab === "home") && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <Gamepad2 className="w-4 h-4 text-purple-400" />
                  Available Games (Mock)
                </h3>
                <span className="text-xs text-purple-400/80">Step 3 Preview</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {MOCK_GAMES.map((game) => (
                  <div
                    key={game.id}
                    onClick={() => {
                      triggerHaptic("medium");
                      setSelectedGame(game.name);
                    }}
                    className={`p-3.5 rounded-xl border bg-gradient-to-r ${game.gradient} ${game.border} flex items-center justify-between cursor-pointer transition-transform active:scale-[0.99]`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl p-2 rounded-lg bg-black/30 border border-white/10">
                        {game.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">{game.name}</h4>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/40 text-purple-200">
                            {game.popularBadge}
                          </span>
                        </div>
                        <p className="text-xs text-purple-300/70 font-medium">
                          {game.currency} • Instant Top-Up
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-purple-300/60" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: MY ORDERS */}
          {activeTab === "orders" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-pink-400" />
                  Recent Orders (Mock)
                </h3>
                <span className="text-xs text-purple-400/80">3 Orders</span>
              </div>

              <div className="space-y-2.5">
                {MOCK_ORDERS.map((order) => (
                  <div
                    key={order.orderNumber}
                    className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-800/30 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-purple-300 font-bold">{order.orderNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          order.status === "SUCCESS"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : order.status === "PROCESSING"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-white">
                        {order.game} • {order.package}
                      </span>
                      <span className="font-extrabold text-purple-200">{order.price}</span>
                    </div>
                    <p className="text-[11px] text-purple-400/60 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {order.date}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: ACCOUNT */}
          {activeTab === "account" && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-400" />
                Telegram Customer Profile
              </h3>

              <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/30 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-xl font-bold text-white shadow-md">
                    {user?.first_name ? user.first_name[0] : "👤"}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">
                      {user?.first_name} {user?.last_name || ""}
                    </h4>
                    <p className="text-xs text-purple-300/80">
                      {user?.username ? `@${user.username}` : "Customer (Telegram Guest)"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-purple-900/30 text-xs">
                  <div className="p-2.5 rounded-lg bg-black/30">
                    <span className="text-purple-400/70 block text-[10px]">Telegram User ID</span>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="font-mono font-bold text-white">
                        {user?.id ? user.id : "Not detected"}
                      </span>
                      {user?.id && (
                        <button onClick={copyUserId} className="text-purple-300">
                          {copiedId ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/30">
                    <span className="text-purple-400/70 block text-[10px]">Store Tier</span>
                    <span className="font-bold text-amber-300 mt-0.5 block">VIP Gamer 💎</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: FAQ */}
          {activeTab === "faq" && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                Frequently Asked Questions
              </h3>

              <div className="space-y-2">
                {MOCK_FAQS.map((faq, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-800/30 space-y-1.5"
                  >
                    <h4 className="font-bold text-white text-xs flex items-center gap-2">
                      <span className="text-purple-400 font-mono">Q:</span>
                      {faq.q}
                    </h4>
                    <p className="text-xs text-purple-300/80 pl-5 leading-relaxed">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ── BOTTOM APP DOCK NAVIGATION ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0517]/95 backdrop-blur-lg border-t border-purple-900/40 px-4 py-2 max-w-md mx-auto">
        <div className="grid grid-cols-5 gap-1 text-center">
          <button
            onClick={() => handleTabChange("home")}
            className={`flex flex-col items-center gap-1 py-1.5 rounded-lg transition-colors ${
              activeTab === "home" ? "text-purple-300 font-bold" : "text-purple-500/60"
            }`}
          >
            <span className="text-lg">💜</span>
            <span className="text-[10px]">Home</span>
          </button>

          <button
            onClick={() => handleTabChange("games")}
            className={`flex flex-col items-center gap-1 py-1.5 rounded-lg transition-colors ${
              activeTab === "games" ? "text-purple-300 font-bold" : "text-purple-500/60"
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span className="text-[10px]">Games</span>
          </button>

          <button
            onClick={() => handleTabChange("orders")}
            className={`flex flex-col items-center gap-1 py-1.5 rounded-lg transition-colors ${
              activeTab === "orders" ? "text-pink-300 font-bold" : "text-purple-500/60"
            }`}
          >
            <Package className="w-4 h-4" />
            <span className="text-[10px]">Orders</span>
          </button>

          <button
            onClick={() => handleTabChange("account")}
            className={`flex flex-col items-center gap-1 py-1.5 rounded-lg transition-colors ${
              activeTab === "account" ? "text-indigo-300 font-bold" : "text-purple-500/60"
            }`}
          >
            <User className="w-4 h-4" />
            <span className="text-[10px]">Account</span>
          </button>

          <button
            onClick={() => handleTabChange("faq")}
            className={`flex flex-col items-center gap-1 py-1.5 rounded-lg transition-colors ${
              activeTab === "faq" ? "text-cyan-300 font-bold" : "text-purple-500/60"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span className="text-[10px]">FAQ</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
