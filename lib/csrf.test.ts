import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateCsrfToken, verifyCsrfToken } from "@/lib/csrf";

const TEST_SECRET = "test-admin-jwt-secret";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Build a token the same way lib/csrf.ts does, with an arbitrary timestamp. */
function craftToken(sessionId: string, timestamp: number, secret = TEST_SECRET): string {
  const hmac = crypto.createHmac("sha256", secret).update(`${sessionId}:${timestamp}`).digest("hex");
  return `${timestamp}.${hmac}`;
}

describe("CSRF tokens", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_JWT_SECRET", TEST_SECRET);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("round-trips", () => {
    const token = generateCsrfToken("admin-1");
    expect(token).toMatch(/^\d+\.[0-9a-f]{64}$/);
    expect(verifyCsrfToken("admin-1", token)).toBe(true);
  });

  it("rejects a token for another session id", () => {
    expect(verifyCsrfToken("admin-2", generateCsrfToken("admin-1"))).toBe(false);
  });

  it("rejects a tampered hmac", () => {
    const [ts, hmac] = generateCsrfToken("admin-1").split(".");
    const flipped = (hmac[0] === "a" ? "b" : "a") + hmac.slice(1);
    expect(verifyCsrfToken("admin-1", `${ts}.${flipped}`)).toBe(false);
    expect(verifyCsrfToken("admin-1", `${ts}.${hmac.slice(0, 63)}`)).toBe(false);
  });

  it("rejects a tampered timestamp", () => {
    const [ts, hmac] = generateCsrfToken("admin-1").split(".");
    expect(verifyCsrfToken("admin-1", `${Number(ts) - 1}.${hmac}`)).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    expect(verifyCsrfToken("admin-1", craftToken("admin-1", Date.now(), "other-secret"))).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(verifyCsrfToken("admin-1", null)).toBe(false);
    expect(verifyCsrfToken("admin-1", "")).toBe(false);
    expect(verifyCsrfToken("admin-1", "no-dot")).toBe(false);
    expect(verifyCsrfToken("admin-1", "1.2.3")).toBe(false);
  });

  it("rejects an expired token (fake timers)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = generateCsrfToken("admin-1");

    vi.setSystemTime(Date.now() + DAY_MS - 1000);
    expect(verifyCsrfToken("admin-1", token)).toBe(true);

    vi.setSystemTime(Date.now() + 2000);
    expect(verifyCsrfToken("admin-1", token)).toBe(false);
  });

  it("rejects a crafted expired or future-dated token", () => {
    expect(verifyCsrfToken("admin-1", craftToken("admin-1", Date.now() - DAY_MS - 60_000))).toBe(false);
    expect(verifyCsrfToken("admin-1", craftToken("admin-1", Date.now() + 60_000))).toBe(false);
  });

  it("fails closed without a secret", () => {
    const token = generateCsrfToken("admin-1");
    vi.stubEnv("ADMIN_JWT_SECRET", "");
    expect(verifyCsrfToken("admin-1", token)).toBe(false);
    expect(() => generateCsrfToken("admin-1")).toThrow();
  });
});
