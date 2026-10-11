/**
 * lib/adminLoginPath.ts — hidden admin login path (Edge-safe, ATK-12).
 *
 * Read at runtime from ADMIN_LOGIN_PATH (no longer inlined by next.config.ts).
 * The fallback is the value next.config.ts used to inline, so behaviour does
 * not change when the env var is unset. Set a long random ADMIN_LOGIN_PATH in
 * production; /api/health/secrets warns when it is missing.
 */
export const LEGACY_ADMIN_LOGIN_PATH = "/admin/theziessstore030511";

export function getAdminLoginPath(): string {
  const custom = process.env.ADMIN_LOGIN_PATH?.trim();
  if (custom && custom.startsWith("/")) {
    const stripped = custom.replace(/\/+$/, "");
    if (stripped) return stripped;
  }
  return LEGACY_ADMIN_LOGIN_PATH;
}
