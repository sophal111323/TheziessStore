import { describe, expect, it } from "vitest";
import { hasAdminPermission, type AdminPermission } from "@/lib/adminPermissions";

const NEW_PERMISSIONS: AdminPermission[] = [
  "banlist.read",
  "banlist.write",
  "blog.read",
  "blog.write",
  "randomPackages.read",
  "randomPackages.write",
  "topup.read",
];

describe("admin permissions (ATK-04)", () => {
  it.each(["OWNER", "SUPERADMIN", "ADMIN"])("%s has the content/supply permissions", (role) => {
    for (const permission of NEW_PERMISSIONS) {
      expect(hasAdminPermission({ role }, permission)).toBe(true);
    }
  });

  it("SUPPORT has none of the content/supply permissions", () => {
    for (const permission of NEW_PERMISSIONS) {
      expect(hasAdminPermission({ role: "SUPPORT" }, permission)).toBe(false);
    }
  });

  it("SUPPORT keeps order access", () => {
    expect(hasAdminPermission({ role: "SUPPORT" }, "orders.read")).toBe(true);
    expect(hasAdminPermission({ role: "SUPPORT" }, "orders.update")).toBe(true);
  });

  it("unknown roles get nothing", () => {
    expect(hasAdminPermission({ role: "CUSTOMER" }, "orders.read")).toBe(false);
    expect(hasAdminPermission({ role: "" }, "blog.read")).toBe(false);
  });
});
