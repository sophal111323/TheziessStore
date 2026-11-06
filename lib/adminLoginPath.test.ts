import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdminLoginPath, LEGACY_ADMIN_LOGIN_PATH } from "@/lib/adminLoginPath";

describe("getAdminLoginPath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the legacy default when unset or blank", () => {
    vi.stubEnv("ADMIN_LOGIN_PATH", "");
    expect(getAdminLoginPath()).toBe(LEGACY_ADMIN_LOGIN_PATH);
    vi.stubEnv("ADMIN_LOGIN_PATH", "   ");
    expect(getAdminLoginPath()).toBe(LEGACY_ADMIN_LOGIN_PATH);
  });

  it("keeps the legacy default value next.config.ts used to inline", () => {
    expect(LEGACY_ADMIN_LOGIN_PATH).toBe("/admin/theziessstore030511");
  });

  it("returns a configured path, trimmed, without trailing slashes", () => {
    vi.stubEnv("ADMIN_LOGIN_PATH", "/admin/abc-123");
    expect(getAdminLoginPath()).toBe("/admin/abc-123");
    vi.stubEnv("ADMIN_LOGIN_PATH", "  /admin/abc-123//  ");
    expect(getAdminLoginPath()).toBe("/admin/abc-123");
  });

  it("ignores values that do not start with '/'", () => {
    vi.stubEnv("ADMIN_LOGIN_PATH", "admin/abc");
    expect(getAdminLoginPath()).toBe(LEGACY_ADMIN_LOGIN_PATH);
    vi.stubEnv("ADMIN_LOGIN_PATH", "/");
    expect(getAdminLoginPath()).toBe(LEGACY_ADMIN_LOGIN_PATH);
  });
});
