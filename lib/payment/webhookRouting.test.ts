import { describe, expect, it } from "vitest";
import { resolveWebhookProvider } from "@/lib/payment/webhookRouting";

describe("resolveWebhookProvider", () => {
  it.each([
    ["KHQRPAY", "khqrpay"],
    ["khqrpay", "khqrpay"],
    ["KhqrPay", "khqrpay"],
    ["JLA", "jla"],
    ["jla", "jla"],
    ["TOLASAINT", "tolasaint"],
    ["tolasaint", "tolasaint"],
    ["ABA", "tolasaint"],
    ["bakong", "tolasaint"],
    ["KHQR", "tolasaint"],
    ["1", "tolasaint"],
  ])("maps %s to %s", (method, expected) => {
    expect(resolveWebhookProvider(method)).toBe(expected);
  });

  it.each(["", "   ", "bogus", "khqr-pay", "jla2", "2", "MANUAL", "simulate"])(
    "rejects %j",
    (method) => {
      expect(resolveWebhookProvider(method)).toBeNull();
    }
  );

  it("rejects null and undefined", () => {
    expect(resolveWebhookProvider(null)).toBeNull();
    expect(resolveWebhookProvider(undefined)).toBeNull();
  });
});
