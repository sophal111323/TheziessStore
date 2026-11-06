/**
 * lib/secretCompare.ts — constant-time string compare (Edge-safe, no Node APIs).
 *
 * Used by middleware (may run on Edge) and route handlers to compare shared
 * secrets (CRON_SECRET, INTERNAL_SECURITY_SECRET, TELEGRAM_WEBHOOK_SECRET,
 * ORIGIN_SHARED_SECRET) without leaking the match position through timing.
 */

/**
 * Returns true only when both values are non-empty strings with identical
 * contents. Fails closed on null/undefined/empty. The loop always runs over
 * the longer length and folds the length difference into the result.
 */
export function timingSafeEqualString(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || b.length === 0) return false;

  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;

  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }

  return diff === 0;
}
