import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateOrderToken,
  isOrderTokenConfigured,
  isRecoverablePlayerUid,
  normalizePlayerUid,
  verifyOrderToken,
} from "@/lib/orderToken";

const TEST_SECRET = "test-order-lookup-secret";

describe("order token with a secret", () => {
  beforeEach(() => {
    vi.stubEnv("ORDER_LOOKUP_SECRET", TEST_SECRET);
    vi.stubEnv("ADMIN_JWT_SECRET", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips", () => {
    const token = generateOrderToken("ORD-1001");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyOrderToken("ORD-1001", token)).toBe(true);
  });

  it("is case- and whitespace-insensitive on the order number", () => {
    const token = generateOrderToken("ORD-1001");
    expect(generateOrderToken("  ord-1001 ")).toBe(token);
    expect(verifyOrderToken("ord-1001", token)).toBe(true);
    expect(verifyOrderToken(" ORD-1001\n", token)).toBe(true);
  });

  it("accepts an upper-case hex token", () => {
    const token = generateOrderToken("ORD-1001");
    expect(verifyOrderToken("ORD-1001", token.toUpperCase())).toBe(true);
  });

  it("rejects a token for another order", () => {
    expect(verifyOrderToken("ORD-1002", generateOrderToken("ORD-1001"))).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    const token = generateOrderToken("ORD-1001");
    vi.stubEnv("ORDER_LOOKUP_SECRET", "different-secret");
    expect(verifyOrderToken("ORD-1001", token)).toBe(false);
  });

  it("rejects wrong, short, long and non-hex tokens", () => {
    const token = generateOrderToken("ORD-1001");
    const flipped = (token[0] === "a" ? "b" : "a") + token.slice(1);
    expect(verifyOrderToken("ORD-1001", flipped)).toBe(false);
    expect(verifyOrderToken("ORD-1001", token.slice(0, 63))).toBe(false);
    expect(verifyOrderToken("ORD-1001", token.slice(0, 32))).toBe(false);
    expect(verifyOrderToken("ORD-1001", token + "0")).toBe(false);
    expect(verifyOrderToken("ORD-1001", "z" + token.slice(1))).toBe(false);
    expect(verifyOrderToken("ORD-1001", ` ${token}`)).toBe(false);
    expect(verifyOrderToken("ORD-1001", "")).toBe(false);
    expect(verifyOrderToken("ORD-1001", null)).toBe(false);
    expect(verifyOrderToken("ORD-1001", undefined)).toBe(false);
  });

  it("is configured", () => {
    expect(isOrderTokenConfigured()).toBe(true);
  });

  it("falls back to ADMIN_JWT_SECRET", () => {
    vi.stubEnv("ORDER_LOOKUP_SECRET", "  ");
    vi.stubEnv("ADMIN_JWT_SECRET", TEST_SECRET);
    expect(isOrderTokenConfigured()).toBe(true);
    const token = generateOrderToken("ORD-1001");
    expect(verifyOrderToken("ORD-1001", token)).toBe(true);
  });
});

describe("order token without a secret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["unset/empty", "", ""],
    ["whitespace only", "   ", "\t"],
  ])("fails closed when secrets are %s", (_label, lookup, jwt) => {
    vi.stubEnv("ORDER_LOOKUP_SECRET", lookup);
    vi.stubEnv("ADMIN_JWT_SECRET", jwt);

    expect(isOrderTokenConfigured()).toBe(false);
    expect(() => generateOrderToken("ORD-1001")).toThrow();
    expect(verifyOrderToken("ORD-1001", "a".repeat(64))).toBe(false);
  });

  it("rejects a previously valid token once the secret is removed", () => {
    vi.stubEnv("ORDER_LOOKUP_SECRET", TEST_SECRET);
    vi.stubEnv("ADMIN_JWT_SECRET", "");
    const token = generateOrderToken("ORD-1001");

    vi.stubEnv("ORDER_LOOKUP_SECRET", "");
    expect(verifyOrderToken("ORD-1001", token)).toBe(false);
  });
});

describe("normalizePlayerUid", () => {
  it("trims, lowercases and strips whitespace", () => {
    expect(normalizePlayerUid("  AbC 123\t45 \n")).toBe("abc12345");
    expect(normalizePlayerUid("123456789")).toBe("123456789");
    expect(normalizePlayerUid("   ")).toBe("");
  });
});

describe("isRecoverablePlayerUid", () => {
  it("rejects empty and the voucher placeholder", () => {
    expect(isRecoverablePlayerUid("")).toBe(false);
    expect(isRecoverablePlayerUid("roblox-user")).toBe(false);
    expect(isRecoverablePlayerUid(normalizePlayerUid(" ROBLOX-USER "))).toBe(false);
  });

  it("accepts real player UIDs", () => {
    expect(isRecoverablePlayerUid("123456789")).toBe(true);
    expect(isRecoverablePlayerUid(normalizePlayerUid("Player One"))).toBe(true);
  });
});
