"use client";

import { useEffect, useState } from "react";

type AdminSettingsForm = {
  siteName?: string;
  exchangeRate?: number | string;
  supportTelegram?: string | null;
  supportTikTok?: string | null;
  supportEmail?: string | null;
  maintenanceMode?: boolean;
  maintenanceMessage?: string | null;
  announcementEnabled?: boolean;
  announcement?: string | null;
  announcementTone?: "info" | "warning" | "promo" | null;
  appMinSupportedVersion?: string;
  appLatestVersion?: string;
  appForceUpdate?: boolean;
  appUpdateUrl?: string | null;
  ordersEnabled?: boolean;
  paymentsEnabled?: boolean;
  promosEnabled?: boolean;
  telegramBotToken?: string | null;
  telegramChatId?: string | null;
  paymentProvider?: "khqrpay" | "jla";
};

export default function AdminSettingsPage() {
  const [form, setForm] = useState<AdminSettingsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setForm({
          ...data,
          paymentProvider: data.paymentProvider ?? "khqrpay",
          announcementEnabled: data.announcementEnabled ?? Boolean(data.announcement),
          appMinSupportedVersion: data.appMinSupportedVersion ?? "1.0.0",
          appLatestVersion: data.appLatestVersion ?? "1.0.0",
          appForceUpdate: data.appForceUpdate ?? false,
          ordersEnabled: data.ordersEnabled ?? true,
          paymentsEnabled: data.paymentsEnabled ?? true,
          promosEnabled: data.promosEnabled ?? true,
        });
      })
      .catch(() => setError("Failed to load settings"));
  }, []);

  function update(key: keyof AdminSettingsForm, value: AdminSettingsForm[keyof AdminSettingsForm]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    setSaving(true);
    setSaved(false);
    setError(null);

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteName: form.siteName,
        exchangeRate: Number(form.exchangeRate),
        supportTelegram: form.supportTelegram || null,
        supportTikTok: form.supportTikTok || null,
        supportEmail: form.supportEmail || "",
        maintenanceMode: Boolean(form.maintenanceMode),
        maintenanceMessage: form.maintenanceMessage || null,
        announcementEnabled: Boolean(form.announcementEnabled),
        announcement: form.announcement || null,
        announcementTone: form.announcementTone || "info",
        appMinSupportedVersion: form.appMinSupportedVersion || "1.0.0",
        appLatestVersion: form.appLatestVersion || "1.0.0",
        appForceUpdate: Boolean(form.appForceUpdate),
        appUpdateUrl: form.appUpdateUrl || null,
        ordersEnabled: form.ordersEnabled ?? true,
        paymentsEnabled: form.paymentsEnabled ?? true,
        promosEnabled: form.promosEnabled ?? true,
        paymentProvider: form.paymentProvider || "khqrpay",
        telegramBotToken: form.telegramBotToken || null,
        telegramChatId: form.telegramChatId || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Save failed");
      setSaving(false);
      return;
    }

    const data = await res.json();
    setForm((current) => ({ ...current, ...data }));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!form) return <div className="p-8 text-fox-muted">{error || "Loading..."}</div>;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display text-3xl font-bold mb-2">Settings</h1>
      <p className="text-fox-muted mb-6">
        Single source of truth for Website, Admin Dashboard, and Flutter App.
      </p>

      <form onSubmit={save} className="card p-6 space-y-8">
        <section className="space-y-4">
          <h2 className="font-semibold text-lg">Public site config</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Site Name</label>
              <input className="input" value={form.siteName || ""} onChange={(e) => update("siteName", e.target.value)} />
            </div>
            <div>
              <label className="label">Exchange Rate (KHR per 1 USD)</label>
              <input className="input" type="number" value={form.exchangeRate || 4100} onChange={(e) => update("exchangeRate", e.target.value)} />
            </div>
            <div>
              <label className="label">Support Telegram</label>
              <input className="input" value={form.supportTelegram || ""} onChange={(e) => update("supportTelegram", e.target.value)} placeholder="@dytopup" />
            </div>
            <div>
              <label className="label">Support TikTok</label>
              <input className="input" value={form.supportTikTok || ""} onChange={(e) => update("supportTikTok", e.target.value)} placeholder="@your_tiktok" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Support Email</label>
              <input className="input" type="email" value={form.supportEmail || ""} onChange={(e) => update("supportEmail", e.target.value)} />
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-fox-border pt-6">
          <h2 className="font-semibold text-lg">Maintenance / close server</h2>
          <label className="flex items-center gap-3 p-4 rounded-lg border border-fox-border bg-fox-surface">
            <input type="checkbox" checked={Boolean(form.maintenanceMode)} onChange={(e) => update("maintenanceMode", e.target.checked)} />
            <div className="flex-1">
              <div className="font-medium">Maintenance Mode</div>
              <div className="text-xs text-fox-muted">Website and Flutter app will show Server Closed.</div>
            </div>
          </label>
          <div>
            <label className="label">Maintenance message</label>
            <input className="input" value={form.maintenanceMessage || ""} onChange={(e) => update("maintenanceMessage", e.target.value)} placeholder="Server កំពុងថែទាំ..." />
          </div>
        </section>

        <section className="space-y-4 border-t border-fox-border pt-6">
          <h2 className="font-semibold text-lg">Announcement bar</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(form.announcementEnabled)} onChange={(e) => update("announcementEnabled", e.target.checked)} />
            Show announcement on website and app
          </label>
          <textarea className="input" rows={2} value={form.announcement || ""} onChange={(e) => update("announcement", e.target.value)} placeholder="Special promotion or service notice" />
          <div className="flex gap-2">
            {(["info", "warning", "promo"] as const).map((tone) => (
              <button key={tone} type="button" onClick={() => update("announcementTone", tone)} className={`text-xs px-3 py-1 rounded-full border ${(form.announcementTone || "info") === tone ? "border-fox-primary bg-fox-primary/10 text-fox-primary" : "border-fox-border text-fox-muted"}`}>
                {tone}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4 border-t border-fox-border pt-6">
          <h2 className="font-semibold text-lg">Flutter app config</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Minimum supported version</label>
              <input className="input font-mono" value={form.appMinSupportedVersion || "1.0.0"} onChange={(e) => update("appMinSupportedVersion", e.target.value)} />
            </div>
            <div>
              <label className="label">Latest version</label>
              <input className="input font-mono" value={form.appLatestVersion || "1.0.0"} onChange={(e) => update("appLatestVersion", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Update URL</label>
              <input className="input" value={form.appUpdateUrl || ""} onChange={(e) => update("appUpdateUrl", e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(form.appForceUpdate)} onChange={(e) => update("appForceUpdate", e.target.checked)} />
            Force all app users to update
          </label>
        </section>

        <section className="space-y-4 border-t border-fox-border pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <span>Payment Provider</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  form.paymentProvider === "jla"
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                }`}>
                  Active: {form.paymentProvider === "jla" ? "JLA Payway" : "KHQRPay"}
                </span>
              </h2>
              <p className="text-xs text-fox-muted mt-1">
                ជ្រើសរើស Gateway សម្រាប់បង្កើតការទូទាត់លើ Order ថ្មីៗ។ Order ចាស់ៗនឹងរក្សា Provider ដើមរបស់វាជានិច្ច។
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label
              className={`flex items-start gap-3.5 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                (form.paymentProvider || "khqrpay") === "khqrpay"
                  ? "border-blue-500 bg-blue-500/10 shadow-md shadow-blue-500/10"
                  : "border-fox-border bg-fox-surface hover:border-fox-border/80"
              }`}
            >
              <input
                type="radio"
                name="paymentProvider"
                value="khqrpay"
                checked={(form.paymentProvider || "khqrpay") === "khqrpay"}
                onChange={() => update("paymentProvider", "khqrpay")}
                className="mt-1 accent-blue-500"
              />
              <div className="flex-1">
                <div className="font-bold flex items-center gap-2">
                  <span>KHQRPay</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">khqrpay.site</span>
                </div>
                <div className="text-xs text-fox-muted mt-1 leading-relaxed">
                  Existing KHQRPay integration. គាំទ្រការបង្កើត KHQR និង Webhook ស្វ័យប្រវត្តិ។
                </div>
              </div>
            </label>

            <label
              className={`flex items-start gap-3.5 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                form.paymentProvider === "jla"
                  ? "border-purple-500 bg-purple-500/10 shadow-md shadow-purple-500/10"
                  : "border-fox-border bg-fox-surface hover:border-fox-border/80"
              }`}
            >
              <input
                type="radio"
                name="paymentProvider"
                value="jla"
                checked={form.paymentProvider === "jla"}
                onChange={() => update("paymentProvider", "jla")}
                className="mt-1 accent-purple-500"
              />
              <div className="flex-1">
                <div className="font-bold flex items-center gap-2">
                  <span>JLA Payway</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">payway.jlastore.com</span>
                </div>
                <div className="text-xs text-fox-muted mt-1 leading-relaxed">
                  JLA Payway gateway. គាំទ្រការបង្កើត KHQR, Deeplink ចូល ABA Mobile App ដោយផ្ទាល់។
                </div>
              </div>
            </label>
          </div>
        </section>

        <section className="space-y-4 border-t border-fox-border pt-6">
          <h2 className="font-semibold text-lg">Feature flags</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              ["ordersEnabled", "Orders enabled"],
              ["paymentsEnabled", "Payments enabled"],
              ["promosEnabled", "Promos enabled"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-lg border border-fox-border bg-fox-surface p-3 text-sm">
                <input type="checkbox" checked={Boolean(form[key as keyof AdminSettingsForm])} onChange={(e) => update(key as keyof AdminSettingsForm, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-4 border-t border-fox-border pt-6">
          <h2 className="font-semibold text-lg">Telegram Notifications</h2>
          <p className="text-xs text-fox-muted">Admin-only. These secrets are never exposed to public API or Flutter app.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Bot token</label>
              <input className="input font-mono text-xs" value={form.telegramBotToken || ""} onChange={(e) => update("telegramBotToken", e.target.value)} placeholder="123456:ABC-DEF..." />
            </div>
            <div>
              <label className="label">Chat ID</label>
              <input className="input font-mono text-xs" value={form.telegramChatId || ""} onChange={(e) => update("telegramChatId", e.target.value)} placeholder="-1001234567890" />
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {saved && <span className="text-sm text-green-400">✓ Saved</span>}
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      </form>
    </div>
  );
}
