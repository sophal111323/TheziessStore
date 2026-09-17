"use client";

import { useEffect, useState } from "react";
import { User, Shield, Check, AlertCircle, Save, Loader2, Link2 } from "lucide-react";
import { Affiliate } from "@/lib/affiliate/types";

export default function CreatorProfilePage() {
  const [creator, setCreator] = useState<Affiliate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [origin, setOrigin] = useState("http://localhost:3000");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    telegram: "",
    facebook: "",
    tiktok: "",
    youtube: "",
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }

    fetch("/api/promote/auth")
      .then((r) => r.json())
      .then((data) => {
        if (data?.creator) {
          setCreator(data.creator);
          setForm({
            name: data.creator.name || "",
            phone: data.creator.phone || "",
            telegram: data.creator.telegram || "",
            facebook: data.creator.facebook || "",
            tiktok: data.creator.tiktok || "",
            youtube: data.creator.youtube || "",
          });
        }
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/promote/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: "error", msg: data.error || "Failed to update profile" });
        setSaving(false);
        return;
      }

      setCreator(data.creator);
      setFeedback({ type: "success", msg: "Profile updated successfully!" });
      setSaving(false);
    } catch {
      setFeedback({ type: "error", msg: "Network error saving profile" });
      setSaving(false);
    }
  }

  if (loading || !creator) {
    return (
      <div className="py-12 text-center text-purple-300 text-xs">
        Loading creator profile…
      </div>
    );
  }

  const referralUrl = `${origin}/${creator.slug}`;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white font-display flex items-center gap-2">
          <User className="h-6 w-6 text-pink-400" />
          <span>Creator Profile</span>
        </h1>
        <p className="text-xs text-purple-300/80 mt-0.5">
          Manage your creator contact information and social channels
        </p>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
              : "bg-red-500/15 border border-red-500/30 text-red-300"
          }`}
        >
          {feedback.type === "success" ? (
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Security / System Badges Card */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-900/80 via-pink-900/40 to-purple-950 p-5 border border-pink-500/30 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-pink-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-pink-300">
            System Assigned Properties (Protected)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-800/40">
            <span className="text-[10px] uppercase font-bold text-purple-400 block mb-1">Status</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-400 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {creator.status}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-800/40">
            <span className="text-[10px] uppercase font-bold text-purple-400 block mb-1">Commission Rate</span>
            <span className="font-bold text-pink-300 font-mono">5.0% Fixed</span>
          </div>

          <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-800/40">
            <span className="text-[10px] uppercase font-bold text-purple-400 block mb-1">Username</span>
            <span className="font-mono text-purple-200 truncate block">@{creator.username}</span>
          </div>

          <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-800/40">
            <span className="text-[10px] uppercase font-bold text-purple-400 block mb-1">Email</span>
            <span className="font-mono text-purple-200 truncate block">{creator.email}</span>
          </div>
        </div>

        {/* Storefront Link Bar */}
        <div className="mt-3 p-3 rounded-xl bg-purple-950/80 border border-purple-700/40 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 className="h-4 w-4 text-pink-400 shrink-0" />
            <span className="text-xs text-purple-300 font-mono truncate">{referralUrl}</span>
          </div>
          <span className="text-[10px] uppercase font-extrabold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">
            Assigned Slug
          </span>
        </div>
      </div>

      {/* Editable Information Form */}
      <div className="rounded-2xl bg-purple-950/60 border border-purple-800/40 p-6 shadow-xl backdrop-blur-md">
        <form onSubmit={handleSave} className="space-y-4">
          <h3 className="text-sm font-bold text-white font-display mb-2">Edit Creator Details</h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl bg-purple-900/60 border border-purple-700/40 px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-purple-200 uppercase tracking-wider mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-xl bg-purple-900/60 border border-purple-700/40 px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-purple-800/30">
            <span className="block text-xs font-bold uppercase tracking-wider text-pink-400 mb-3">
              Social Channels & Contact
            </span>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-purple-300 mb-1">Telegram Username</label>
                <input
                  type="text"
                  placeholder="@username"
                  value={form.telegram}
                  onChange={(e) => setForm({ ...form, telegram: e.target.value })}
                  className="w-full rounded-xl bg-purple-900/60 border border-purple-700/40 px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-purple-300 mb-1">TikTok Handle</label>
                <input
                  type="text"
                  placeholder="@creator.game"
                  value={form.tiktok}
                  onChange={(e) => setForm({ ...form, tiktok: e.target.value })}
                  className="w-full rounded-xl bg-purple-900/60 border border-purple-700/40 px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-purple-300 mb-1">Facebook Profile / Page</label>
                <input
                  type="text"
                  placeholder="Facebook page name"
                  value={form.facebook}
                  onChange={(e) => setForm({ ...form, facebook: e.target.value })}
                  className="w-full rounded-xl bg-purple-900/60 border border-purple-700/40 px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-purple-300 mb-1">YouTube Channel</label>
                <input
                  type="text"
                  placeholder="Channel name or link"
                  value={form.youtube}
                  onChange={(e) => setForm({ ...form, youtube: e.target.value })}
                  className="w-full rounded-xl bg-purple-900/60 border border-purple-700/40 px-3.5 py-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-500 hover:bg-pink-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-pink-500/25 transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

