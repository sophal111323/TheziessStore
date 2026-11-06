/**
 * lib/pathNormalize.ts — canonical path for middleware security checks
 * (Edge-safe, no Node APIs).
 *
 * Middleware compares paths with startsWith/===; encoded or doubled slashes
 * (`/%61dmin`, `//admin`, `/admin/`) must not slip past those checks.
 */
export function normalizePathForChecks(p: string): string {
  let decoded = p;
  try {
    decoded = decodeURIComponent(p);
  } catch {
    // Malformed escape sequence (e.g. "%E0"): keep the raw input.
    decoded = p;
  }

  let out = decoded.replace(/\/{2,}/g, "/");
  if (out.length > 1) {
    out = out.replace(/\/+$/, "");
  }

  return out || "/";
}
