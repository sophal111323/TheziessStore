import { describe, expect, it } from "vitest";
import { checkOriginLock, ORIGIN_LOCK_HEADER } from "@/lib/originLock";

const SECRET = "test-origin-secret-1234567890";

describe("checkOriginLock", () => {
  it("uses the x-origin-secret header name", () => {
    expect(ORIGIN_LOCK_HEADER).toBe("x-origin-secret");
  });

  it("passes everything when the secret is unset or blank", () => {
    for (const secret of [undefined, null, "", "   "]) {
      expect(checkOriginLock({ pathname: "/admin", headerValue: null, secret })).toEqual({ ok: true });
      expect(checkOriginLock({ pathname: "/api/orders", headerValue: "x", secret })).toEqual({ ok: true });
    }
  });

  it("passes an exact match", () => {
    expect(checkOriginLock({ pathname: "/", headerValue: SECRET, secret: SECRET })).toEqual({ ok: true });
  });

  it("rejects a wrong value", () => {
    expect(checkOriginLock({ pathname: "/", headerValue: SECRET + "x", secret: SECRET })).toEqual({
      ok: false,
      reason: "mismatch",
    });
    expect(checkOriginLock({ pathname: "/api/orders", headerValue: "nope", secret: SECRET })).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  it("rejects a missing header", () => {
    expect(checkOriginLock({ pathname: "/admin", headerValue: null, secret: SECRET })).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(checkOriginLock({ pathname: "/admin", headerValue: "", secret: SECRET })).toEqual({
      ok: false,
      reason: "missing",
    });
  });

  it("exempts webhook, track and health paths", () => {
    for (const pathname of [
      "/api/payment/webhook/khqrpay",
      "/api/payment/webhook/bogus",
      "/api/payments/webhook",
      "/api/webhooks/frozenyuki",
      "/api/telegram/webhook",
      "/api/security/track",
      "/api/health",
    ]) {
      expect(checkOriginLock({ pathname, headerValue: null, secret: SECRET })).toEqual({ ok: true });
    }
  });

  it("does not exempt /api/health/secrets or dot-segment tricks", () => {
    expect(checkOriginLock({ pathname: "/api/health/secrets", headerValue: null, secret: SECRET }).ok).toBe(false);
    expect(checkOriginLock({ pathname: "/api/healthz", headerValue: null, secret: SECRET }).ok).toBe(false);
    expect(
      checkOriginLock({ pathname: "/api/webhooks/../orders", headerValue: null, secret: SECRET }).ok
    ).toBe(false);
  });
});
