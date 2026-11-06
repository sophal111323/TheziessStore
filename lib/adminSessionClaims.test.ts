import { describe, expect, it } from "vitest";
import { ADMIN_SESSION_TOKEN_TYPE, isAdminSessionClaims } from "@/lib/adminSessionClaims";

describe("isAdminSessionClaims", () => {
  it("accepts typed admin session claims", () => {
    expect(isAdminSessionClaims({ adminId: "admin-1", typ: ADMIN_SESSION_TOKEN_TYPE })).toBe(true);
    expect(isAdminSessionClaims({ adminId: "admin-1", typ: "admin-session", iat: 1, exp: 2 })).toBe(true);
  });

  it("rejects other token types and untyped legacy claims", () => {
    expect(isAdminSessionClaims({ adminId: "admin-1" })).toBe(false);
    expect(isAdminSessionClaims({ adminId: "admin-1", type: "admin-2fa-pending" })).toBe(false);
    expect(isAdminSessionClaims({ adminId: "admin-1", type: "admin-telegram-key-pending" })).toBe(false);
    expect(isAdminSessionClaims({ adminId: "admin-1", typ: "admin-2fa-pending" })).toBe(false);
    expect(isAdminSessionClaims({ affiliateId: "aff-1", type: "creator_session" })).toBe(false);
    expect(isAdminSessionClaims({ userId: "u1", telegramUserId: "1", username: null })).toBe(false);
  });

  it("rejects missing, empty or non-string adminId", () => {
    expect(isAdminSessionClaims({ typ: ADMIN_SESSION_TOKEN_TYPE })).toBe(false);
    expect(isAdminSessionClaims({ typ: ADMIN_SESSION_TOKEN_TYPE, adminId: "" })).toBe(false);
    expect(isAdminSessionClaims({ typ: ADMIN_SESSION_TOKEN_TYPE, adminId: 42 })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isAdminSessionClaims(null)).toBe(false);
    expect(isAdminSessionClaims(undefined)).toBe(false);
    expect(isAdminSessionClaims("admin-session")).toBe(false);
    expect(isAdminSessionClaims(123)).toBe(false);
  });
});
