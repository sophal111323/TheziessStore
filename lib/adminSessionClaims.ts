/**
 * lib/adminSessionClaims.ts — Admin session JWT claim shape (ATK-02).
 *
 * Pure module (no imports) so both lib/auth.ts (Node) and middleware.ts
 * (Edge) can share it. Every JWT signed with ADMIN_JWT_SECRET that is NOT a
 * full admin session (2FA-pending, Telegram-key-pending, lock hints, and any
 * customer/creator token that falls back to the same secret) lacks this
 * `typ`, so it can never be used as an admin session.
 */

export const ADMIN_SESSION_TOKEN_TYPE = "admin-session";

export function isAdminSessionClaims(
  payload: unknown
): payload is { adminId: string; typ: string } {
  if (!payload || typeof payload !== "object") return false;
  const claims = payload as { adminId?: unknown; typ?: unknown };
  return (
    claims.typ === ADMIN_SESSION_TOKEN_TYPE &&
    typeof claims.adminId === "string" &&
    claims.adminId.length > 0
  );
}
