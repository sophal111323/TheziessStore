"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Shield, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function CreatorRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    telegram: "",
    facebook: "",
    tiktok: "",
    youtube: "",
    password: "",
    confirmPassword: "",
    agree: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!form.agree) {
      setError("You must accept the Creator Program Terms");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/promote/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          ...form,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to create creator account");
        setLoading(false);
        return;
      }

      router.push("/promote/dashboard");
      router.refresh();
    } catch {
      setError("An unexpected network error occurred. Please try again.");
      setLoading(false);
    }
  }

  const previewSlug = form.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-950 via-purple-900 to-indigo-950 text-white flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow ornaments */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-purple-600/30 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-pink-600/25 blur-[120px]" />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-1.5 border border-purple-400/30 backdrop-blur-md mb-4 shadow-lg shadow-purple-900/40">
            <Sparkles className="h-4 w-4 text-pink-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-purple-200">TheziessStore Creator Program</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-display">
            Become a Content Creator
          </h1>
          <p className="mt-2 text-sm text-purple-200/80 max-w-md mx-auto">
            Earn 5% commission on every order when gamers top up through your personal link. Instant auto-approval!
          </p>
        </div>

        <div className="bg-purple-900/60 backdrop-blur-2xl border border-purple-400/25 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-purple-950/80">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-400/40 bg-red-500/20 p-3.5 text-xs text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-300 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Davin Sok"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl bg-purple-950/60 border border-purple-400/30 px-3.5 py-2.5 text-sm text-white placeholder-purple-400/50 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                  Username (Store Slug) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. davin"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                  className="w-full rounded-xl bg-purple-950/60 border border-purple-400/30 px-3.5 py-2.5 text-sm font-mono text-pink-300 placeholder-purple-400/50 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all"
                />
                {previewSlug && (
                  <p className="mt-1 text-[11px] text-pink-300/80 font-mono truncate">
                    👉 your link: theziessstore.store/{previewSlug}
                  </p>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@gmail.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-xl bg-purple-950/60 border border-purple-400/30 px-3.5 py-2.5 text-sm text-white placeholder-purple-400/50 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="012 345 678"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-xl bg-purple-950/60 border border-purple-400/30 px-3.5 py-2.5 text-sm text-white placeholder-purple-400/50 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all"
                />
              </div>
            </div>

            {/* Social Media channels */}
            <div className="pt-2 border-t border-purple-400/20">
              <span className="block text-xs font-bold uppercase tracking-wider text-pink-400 mb-2">
                Social Channels (For promotion verification)
              </span>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Telegram Username (e.g. @davin_kh)"
                  value={form.telegram}
                  onChange={(e) => setForm({ ...form, telegram: e.target.value })}
                  className="w-full rounded-xl bg-purple-950/60 border border-purple-400/30 px-3 py-2 text-xs text-white placeholder-purple-400/50 focus:border-pink-400 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="TikTok Username (e.g. @davin.game)"
                  value={form.tiktok}
                  onChange={(e) => setForm({ ...form, tiktok: e.target.value })}
                  className="w-full rounded-xl bg-purple-950/60 border border-purple-400/30 px-3 py-2 text-xs text-white placeholder-purple-400/50 focus:border-pink-400 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Facebook Page/Profile Name"
                  value={form.facebook}
                  onChange={(e) => setForm({ ...form, facebook: e.target.value })}
                  className="w-full rounded-xl bg-purple-950/60 border border-purple-400/30 px-3 py-2 text-xs text-white placeholder-purple-400/50 focus:border-pink-400 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="YouTube Channel Name"
                  value={form.youtube}
                  onChange={(e) => setForm({ ...form, youtube: e.target.value })}
                  className="w-full rounded-xl bg-purple-950/60 border border-purple-400/30 px-3 py-2 text-xs text-white placeholder-purple-400/50 focus:border-pink-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Password fields */}
            <div className="pt-2 border-t border-purple-400/20 grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-xl bg-purple-950/60 border border-purple-400/30 px-3.5 py-2.5 text-sm text-white placeholder-purple-400/50 focus:border-pink-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  className="w-full rounded-xl bg-purple-950/60 border border-purple-400/30 px-3.5 py-2.5 text-sm text-white placeholder-purple-400/50 focus:border-pink-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Agreement */}
            <label className="flex items-start gap-3 text-xs text-purple-200/90 pt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.agree}
                onChange={(e) => setForm({ ...form, agree: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-purple-400/40 bg-purple-950 text-pink-600 focus:ring-pink-500"
              />
              <span>
                I agree to the <strong className="text-pink-300">TheziessStore Creator Program Terms</strong> and confirm that all details provided are accurate.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 py-3 text-sm font-extrabold text-white shadow-lg shadow-pink-500/25 hover:from-pink-600 hover:to-indigo-600 hover:shadow-pink-500/40 transition-all duration-300 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating Account…</span>
                </>
              ) : (
                <>
                  <span>Create Creator Account</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-purple-300/70 pt-4 border-t border-purple-400/20">
            Already have a creator account?{" "}
            <Link href="/promote/login" className="font-bold text-pink-400 hover:text-pink-300 underline">
              Login to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

