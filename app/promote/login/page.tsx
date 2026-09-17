"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, AlertCircle, Loader2, UserCheck } from "lucide-react";

export default function CreatorLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e?: React.FormEvent, customUser?: string, customPass?: string) {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const userToSubmit = customUser || identifier;
    const passToSubmit = customPass || password;

    try {
      const res = await fetch("/api/promote/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          identifier: userToSubmit,
          password: passToSubmit,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Invalid username or password");
        setLoading(false);
        return;
      }

      router.push("/promote/dashboard");
      router.refresh();
    } catch {
      setError("Network error logging in. Please try again.");
      setLoading(false);
    }
  }

  function fillDemo(username: string) {
    setIdentifier(username);
    setPassword("password123");
    handleLogin(undefined, username, "password123");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-950 via-purple-900 to-indigo-950 text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow ornaments */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-pink-600/25 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-purple-600/30 blur-[120px]" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-1.5 border border-purple-400/30 backdrop-blur-md mb-4 shadow-lg shadow-purple-900/40">
            <Sparkles className="h-4 w-4 text-pink-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-purple-200">TheziessStore Creator</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white font-display">
            Creator Portal
          </h1>
          <p className="mt-2 text-sm text-purple-200/80">
            Log in to manage your referrals, track sales, and withdraw commissions.
          </p>
        </div>

        <div className="bg-purple-900/60 backdrop-blur-2xl border border-purple-400/25 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-purple-950/80">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-400/40 bg-red-500/20 p-3.5 text-xs text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-300 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                Username or Email
              </label>
              <input
                type="text"
                required
                placeholder="e.g. davin"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full rounded-xl bg-purple-950/60 border border-purple-400/30 px-3.5 py-2.5 text-sm text-white placeholder-purple-400/50 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-purple-950/60 border border-purple-400/30 px-3.5 py-2.5 text-sm text-white placeholder-purple-400/50 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 py-3 text-sm font-extrabold text-white shadow-lg shadow-pink-500/25 hover:from-pink-600 hover:to-indigo-600 hover:shadow-pink-500/40 transition-all duration-300 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Logging in…</span>
                </>
              ) : (
                <>
                  <span>Login to Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins for Localhost UI Testing */}
          <div className="mt-6 pt-5 border-t border-purple-400/20">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-purple-300/80 mb-2.5 text-center">
              ⚡ Quick Demo Testing (Localhost)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemo("davin")}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-pink-400/30 bg-pink-500/10 px-3 py-2 text-xs font-semibold text-pink-300 hover:bg-pink-500/20 transition-all"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Davin (87 Orders)</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemo("somnang")}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-purple-400/30 bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition-all"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Somnang (143 Orders)</span>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-purple-300/70 pt-4 border-t border-purple-400/20">
            Don&apos;t have a creator account yet?{" "}
            <Link href="/promote/register" className="font-bold text-pink-400 hover:text-pink-300 underline">
              Register Here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

