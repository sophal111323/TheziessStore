import { NextResponse } from "next/server";
import type { Admin } from "@prisma/client";

export type NormalizedAdminRole = "OWNER" | "ADMIN" | "SUPPORT";

export type AdminPermission =
  | "dashboard.read"
  | "orders.read"
  | "orders.update"
  | "products.read"
  | "products.write"
  | "games.read"
  | "games.write"
  | "banners.read"
  | "banners.write"
  | "settings.read"
  | "settings.write"
  | "faqs.read"
  | "faqs.write"
  | "promoCodes.read"
  | "promoCodes.write"
  | "customers.read"
  | "customers.update"
  | "auditLogs.read"
  | "notifications.read"
  | "notifications.write"
  | "banlist.read"
  | "banlist.write"
  | "blog.read"
  | "blog.write"
  | "randomPackages.read"
  | "randomPackages.write"
  | "topup.read";

// OWNER/ADMIN only (ATK-04): SUPPORT must not edit mystery boxes, blog,
// banlist or read the supplier balance/catalog.
const CONTENT_AND_SUPPLY_PERMISSIONS: AdminPermission[] = [
  "banlist.read",
  "banlist.write",
  "blog.read",
  "blog.write",
  "randomPackages.read",
  "randomPackages.write",
  "topup.read",
];

export function normalizeAdminRole(role: string | null | undefined): NormalizedAdminRole | null {
  const value = (role || "").toUpperCase().trim();
  if (value === "OWNER" || value === "SUPERADMIN") return "OWNER";
  if (value === "ADMIN") return "ADMIN";
  if (value === "SUPPORT") return "SUPPORT";
  return null;
}

const rolePermissions: Record<NormalizedAdminRole, AdminPermission[]> = {
  OWNER: [
    "dashboard.read",
    "orders.read",
    "orders.update",
    "products.read",
    "products.write",
    "games.read",
    "games.write",
    "banners.read",
    "banners.write",
    "settings.read",
    "settings.write",
    "faqs.read",
    "faqs.write",
    "promoCodes.read",
    "promoCodes.write",
    "customers.read",
    "customers.update",
    "auditLogs.read",
    "notifications.read",
    "notifications.write",
    ...CONTENT_AND_SUPPLY_PERMISSIONS,
  ],
  ADMIN: [
    "dashboard.read",
    "orders.read",
    "orders.update",
    "products.read",
    "products.write",
    "games.read",
    "games.write",
    "banners.read",
    "banners.write",
    "faqs.read",
    "faqs.write",
    "promoCodes.read",
    "promoCodes.write",
    "customers.read",
    "auditLogs.read",
    "notifications.read",
    "notifications.write",
    ...CONTENT_AND_SUPPLY_PERMISSIONS,
  ],
  SUPPORT: [
    "dashboard.read",
    "orders.read",
    "orders.update",
    "customers.read",
    "notifications.read",
    "notifications.write",
  ],
};

export function hasAdminPermission(
  admin: Pick<Admin, "role">,
  permission: AdminPermission
): boolean {
  const role = normalizeAdminRole(admin.role);
  if (!role) return false;
  return rolePermissions[role].includes(permission);
}

export function hasAnyAdminPermission(
  admin: Pick<Admin, "role">,
  permissions: AdminPermission[]
): boolean {
  return permissions.some((permission) => hasAdminPermission(admin, permission));
}

export function isAdminRoleAllowed(
  admin: Pick<Admin, "role">,
  roles: NormalizedAdminRole[]
): boolean {
  const role = normalizeAdminRole(admin.role);
  return !!role && roles.includes(role);
}

export function forbiddenResponse(message = "Forbidden") {
  return NextResponse.json(
    { error: message },
    {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
