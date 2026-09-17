"use client";

import { useEffect, useState, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  BarChart3,
  Coins,
  CreditCard,
  Megaphone,
  User,
  Bell,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Check,
} from "lucide-react";
import { Affiliate, AffiliateNotification } from "@/lib/affiliate/types";

const NAV_ITEMS = [
  { href: "/promote/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/promote/orders", label: "Orders", icon: ShoppingBag },
  { href: "/promote/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/promote/earnings", label: "Earnings", icon: Coins },
  { href: "/promote/payouts", label: "Payouts", icon: CreditCard },
  { href: "/promote/marketing", label: "Marketing", icon: Megaphone },
  { href: "/promote/profile", label: "Profile", icon: User },
];

export default function CreatorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // If on login or register, don't show the dashboard shell
  const isAuthPage = pathname === "/promote/login" || pathname === "/promote/register";

  const [creator, setCreator] = useState<Affiliate | null>(null);
  const [notifications, setNotifications] = useState<AffiliateNotification[]>([]);
  const [loading, setLoading] = useState(!isAuthPage);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isAuthPage) return;

    let mounted = true;
    fetch("/api/promote/auth")
      .then((res) => {
        if (!res.ok) {
          router.push("/promote/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (mounted && data?.authenticated) {
          setCreator(data.creator);
          setNotifications(data.notifications || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) router.push("/promote/login");
      });

    return () => {
      mounted = false;
    };
  }, [isAuthPage, router]);

  async function handleLogout() {
    await fetch("/api/promote/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/promote/login");
    router.refresh();
  }

  async function handleMarkRead() {
    await fetch("/api/promote/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_notifications" }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-purple-950 flex flex-col items-center justify-center text-purple-200">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-pink-500 border-t-transparent mb-4" />
        <p className="text-xs uppercase tracking-widest font-bold">Loading Creator Portal…</p>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* ── DESKTOP SIDEBAR ────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-purple-950/80 border-r border-purple-800/40 backdrop-blur-xl relative z-20">
        <div className="p-5 border-b border-purple-800/30 flex items-center gap-3">
          <Image
            src="/theziessstore-logo.png"
            alt="TheziessStore"
            width={40}
            height={40}
            className="h-8 w-auto object-contain"
          />
          <div>
            <div className="font-display font-black text-sm text-white leading-tight">
              Theziess<span className="text-pink-400">Store</span>
            </div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-pink-400">
              Creator Portal
            </div>
          </div>
        </div>

        {/* Creator Info Snippet */}
        {creator && (
          <div className="p-4 mx-3 mt-4 rounded-2xl bg-purple-900/40 border border-purple-700/30 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-md shadow-pink-500/20">
              {creator.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">{creator.name}</div>
              <div className="text-[11px] font-mono text-purple-300 truncate">@{creator.username}</div>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
              5%
            </span>
          </div>
        )}

        {/* Navigation links */}
        <nav className="flex-1 p-3 space-y-1.5 mt-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/25"
                    : "text-purple-200 hover:bg-purple-900/40 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Storefront quick link */}
        {creator && (
          <div className="p-3 border-t border-purple-800/30">
            <Link
              href={`/${creator.slug}`}
              target="_blank"
              className="flex items-center justify-between px-3 py-2 rounded-xl bg-purple-900/50 hover:bg-purple-800/50 text-xs font-semibold text-pink-300 border border-pink-500/20 transition-colors"
            >
              <span>View My Storefront</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* Logout */}
        <div className="p-3 border-t border-purple-800/30">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-bold text-red-300 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 h-16 bg-purple-950/70 backdrop-blur-xl border-b border-purple-800/30 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-purple-200 hover:text-white rounded-lg hover:bg-purple-900/40"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="font-display font-bold text-sm sm:text-base text-white truncate">
              {NAV_ITEMS.find((n) => n.href === pathname)?.label || "Creator Portal"}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  if (unreadCount > 0) handleMarkRead();
                }}
                className="relative p-2 text-purple-200 hover:text-white rounded-xl hover:bg-purple-900/40 transition-colors"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[10px] font-black text-white ring-2 ring-purple-950 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popup Drawer */}
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-purple-950/95 border border-purple-700/40 shadow-2xl backdrop-blur-2xl p-4 z-50 animate-scale-in">
                  <div className="flex items-center justify-between pb-3 border-b border-purple-800/40">
                    <span className="text-xs font-bold uppercase tracking-wider text-pink-300">
                      Notifications
                    </span>
                    <button
                      onClick={() => setNotifOpen(false)}
                      className="text-purple-400 hover:text-white text-xs"
                    >
                      Close
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-purple-800/30 mt-2">
                    {notifications.length === 0 ? (
                      <p className="text-center py-6 text-xs text-purple-400">No notifications yet</p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white">{n.title}</span>
                            <span className="text-[10px] text-purple-400">
                              {new Date(n.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-purple-300/80 mt-0.5">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* View storefront badge on top bar */}
            {creator && (
              <Link
                href={`/${creator.slug}`}
                target="_blank"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-pink-500/30 bg-pink-500/10 px-3 py-1.5 text-xs font-bold text-pink-300 hover:bg-pink-500/20 transition-all"
              >
                <span>Storefront: /{creator.slug}</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </header>

        {/* Mobile slide-over navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-purple-950/95 border-b border-purple-800/40 px-4 py-4 space-y-2 z-40">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold ${
                    isActive ? "bg-pink-500 text-white" : "text-purple-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {creator && (
              <Link
                href={`/${creator.slug}`}
                target="_blank"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-pink-300 border border-pink-500/30"
              >
                <span>View Storefront (/{creator.slug})</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-bold text-red-300"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {/* ── MOBILE BOTTOM NAVIGATION BAR ───────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-purple-950/90 backdrop-blur-xl border-t border-purple-800/40 py-2 px-3 flex items-center justify-around">
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
                isActive ? "text-pink-400" : "text-purple-300/70"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

