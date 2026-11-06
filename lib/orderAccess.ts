/**
 * lib/orderAccess.ts — client-safe order token helpers.
 *
 * Do NOT import Node `crypto` here: this file is bundled into client components.
 * Tokens are issued by the server (lib/orderToken.ts) and transported as `?token=`.
 */

const STORAGE_PREFIX = "orderToken:";

function storageKey(orderNumber: string): string {
  return STORAGE_PREFIX + orderNumber.trim().toUpperCase();
}

/** Persists a token for an order in localStorage (no-op on the server or when storage is blocked). */
export function saveOrderToken(orderNumber: string, token: string | null | undefined): void {
  if (typeof window === "undefined" || !orderNumber || !token) return;
  try {
    window.localStorage.setItem(storageKey(orderNumber), token);
  } catch {
    // Storage unavailable (private mode / quota) — token still works for this page view.
  }
}

/**
 * Returns the token for an order: `?token=` in the current URL wins (and is persisted),
 * otherwise the value saved in localStorage. Returns null on the server.
 */
export function getOrderToken(orderNumber: string | null | undefined): string | null {
  if (typeof window === "undefined" || !orderNumber) return null;

  try {
    const fromUrl = new URLSearchParams(window.location.search).get("token");
    if (fromUrl) {
      saveOrderToken(orderNumber, fromUrl);
      return fromUrl;
    }
  } catch {
    // Ignore malformed URL state
  }

  return getStoredOrderToken(orderNumber);
}

/**
 * Returns only the localStorage token for an order (ignores `?token=`). Use when the
 * URL token may belong to a different order (e.g. the tracker's manual lookup).
 */
export function getStoredOrderToken(orderNumber: string | null | undefined): string | null {
  if (typeof window === "undefined" || !orderNumber) return null;
  try {
    return window.localStorage.getItem(storageKey(orderNumber));
  } catch {
    return null;
  }
}

/** Appends `token=<token>` to a path, choosing `?` or `&`. No-op when the token is empty. */
export function withOrderToken(path: string, token: string | null | undefined): string {
  if (!token) return path;
  const hashIndex = path.indexOf("#");
  const base = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}token=${encodeURIComponent(token)}${hash}`;
}
