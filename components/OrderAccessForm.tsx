"use client";

import { useId, useState } from "react";
import { KeyRound, XCircle } from "lucide-react";
import { saveOrderToken } from "@/lib/orderAccess";

interface OrderAccessFormProps {
  orderNumber: string;
  /** Called with the recovered token after it has been saved to localStorage. */
  onToken: (token: string) => void;
  className?: string;
}

/**
 * Recovers the HMAC order token by proving ownership with the Player UID used
 * on the order (POST /api/orders/access). Shown when a customer opens an order,
 * gift or spin page without a token link.
 */
export default function OrderAccessForm({ orderNumber, onToken, className }: OrderAccessFormProps) {
  const inputId = useId();
  const errorId = useId();
  const [playerUid, setPlayerUid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const uid = playerUid.trim();
    if (!uid || !orderNumber) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/orders/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, playerUid: uid }),
        cache: "no-store",
      });

      if (res.status === 429) {
        setError("Too many attempts. Please wait a few minutes and try again.");
        return;
      }

      const data = await res.json().catch(() => null);
      const token = typeof data?.orderToken === "string" ? data.orderToken : "";

      if (!res.ok || !token) {
        setError("Order not found or Player UID does not match.");
        return;
      }

      saveOrderToken(orderNumber, token);
      onToken(token);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className={className ?? "card p-5 sm:p-6"} noValidate>
      <p className="mb-3 text-sm text-purple-700">
        ដើម្បីការពារការបញ្ជាទិញរបស់អ្នក សូមបញ្ចូល Player UID ដែលបានប្រើសម្រាប់ការបញ្ជាទិញ{" "}
        <span className="font-mono font-bold">{orderNumber}</span>
        <span className="block text-xs text-purple-500">
          (Enter the Player UID used for this order to view it.)
        </span>
      </p>

      <label htmlFor={inputId} className="label">
        Player UID
      </label>

      <div className="flex gap-3">
        <input
          id={inputId}
          type="text"
          value={playerUid}
          onChange={(e) => setPlayerUid(e.target.value)}
          autoComplete="off"
          maxLength={100}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="input font-mono"
        />

        <button
          type="submit"
          disabled={loading || !playerUid.trim()}
          className="btn-primary shrink-0 disabled:opacity-60"
        >
          {loading ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden="true"
            />
          ) : (
            <KeyRound className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          )}
          <span>{loading ? "Checking…" : "Continue"}</span>
        </button>
      </div>

      <div id={errorId} aria-live="polite" className="min-h-[1.25rem]">
        {error && (
          <p className="mt-3 flex items-center gap-2 text-sm text-red-500">
            <XCircle className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
