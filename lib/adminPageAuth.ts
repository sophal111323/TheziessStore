/**
 * lib/adminPageAuth.ts — Auth for admin Server Components and Server Actions
 * (ATK-03). Server-only: depends on next/headers cookies via getCurrentAdmin.
 *
 * Middleware is not a sufficient gate: Server Functions are POSTs to the page
 * route and must verify auth themselves (Next.js proxy.md). Each admin server
 * page calls requireAdminPage first; each Server Action calls
 * requireAdminAction as its first line.
 */

import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { hasAdminPermission, type AdminPermission } from "@/lib/adminPermissions";

/** Renders 404 (same as middleware) unless a valid admin holds `permission`. */
export async function requireAdminPage(permission: AdminPermission) {
  const admin = await getCurrentAdmin();
  if (!admin || !hasAdminPermission(admin, permission)) {
    notFound();
  }
  return admin;
}

/** Throws unless a valid admin holds `permission`. */
export async function requireAdminAction(permission: AdminPermission) {
  const admin = await getCurrentAdmin();
  if (!admin || !hasAdminPermission(admin, permission)) {
    throw new Error("Unauthorized");
  }
  return admin;
}
