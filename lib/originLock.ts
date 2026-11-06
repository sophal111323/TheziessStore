/**
 * lib/originLock.ts — opt-in Cloudflare origin lock (Edge-safe, ATK-06).
 *
 * When ORIGIN_SHARED_SECRET is set, every request must carry the same value
 * in `x-origin-secret`. A Cloudflare Transform Rule adds that header, so
 * direct hits on the Render origin (*.onrender.com) — where cf-connecting-ip
 * can be forged — are refused. Unset secret → behaviour unchanged.
 *
 * Exempt paths authenticate by signature / shared secret / gateway
 * confirmation (not by IP) and may be configured with the onrender URL by
 * third parties; /api/security/track is middleware's own sub-request.
 */
import { timingSafeEqualString } from "@/lib/secretCompare";

export const ORIGIN_LOCK_HEADER = "x-origin-secret";

export const ORIGIN_LOCK_EXEMPT_PREFIXES = [
  "/api/payment/webhook",
  "/api/payments/webhook",
  "/api/webhooks/",
  "/api/telegram/webhook",
  "/api/security/track",
];

export const ORIGIN_LOCK_EXEMPT_EXACT = ["/api/health"];

export type OriginLockResult = { ok: boolean; reason?: "missing" | "mismatch" };

export function isOriginLockExempt(pathname: string): boolean {
  // Never exempt paths with dot segments (e.g. a decoded "%2F.." trick).
  if (pathname.split("/").includes("..")) return false;
  if (ORIGIN_LOCK_EXEMPT_EXACT.includes(pathname)) return true;
  return ORIGIN_LOCK_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
}

export function checkOriginLock({
  pathname,
  headerValue,
  secret,
}: {
  pathname: string;
  headerValue: string | null | undefined;
  secret: string | null | undefined;
}): OriginLockResult {
  const expected = secret?.trim();
  if (!expected) return { ok: true };

  if (isOriginLockExempt(pathname)) return { ok: true };

  const provided = headerValue?.trim();
  if (!provided) return { ok: false, reason: "missing" };

  return timingSafeEqualString(provided, expected)
    ? { ok: true }
    : { ok: false, reason: "mismatch" };
}
