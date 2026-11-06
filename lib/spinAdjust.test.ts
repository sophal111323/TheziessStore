import { describe, expect, it } from "vitest";
import { hasAdminPermission } from "@/lib/adminPermissions";
import {
  isSpinOrderPaid,
  isSpinRetryable,
  normalizeSpinAdjustAction,
  spinAdjustPermission,
} from "@/lib/spinAdjust";

describe("spin adjust action normalization", () => {
  it("maps aliases and rejects unknown actions", () => {
    expect(normalizeSpinAdjustAction("retry_delivery")).toBe("RETRY_DELIVERY");
    expect(normalizeSpinAdjustAction("retry")).toBe("RETRY_DELIVERY");
    expect(normalizeSpinAdjustAction("blacklist")).toBe("BLACKLIST");
    expect(normalizeSpinAdjustAction("BLACKLIST_USER")).toBe("BLACKLIST");
    expect(normalizeSpinAdjustAction("mark_completed")).toBe("MARK_COMPLETED");
    expect(normalizeSpinAdjustAction("update_reward")).toBe("UPDATE_REWARD");
    expect(normalizeSpinAdjustAction("delete")).toBeNull();
    expect(normalizeSpinAdjustAction("")).toBeNull();
  });
});

describe("spin adjust permissions (R-1)", () => {
  const allowed = (role: string, action: string) => {
    const normalized = normalizeSpinAdjustAction(action);
    if (!normalized) return false;
    return (
      hasAdminPermission({ role }, "orders.update") &&
      hasAdminPermission({ role }, spinAdjustPermission(normalized))
    );
  };

  it("SUPPORT may only retry / mark completed", () => {
    expect(allowed("SUPPORT", "retry_delivery")).toBe(true);
    expect(allowed("SUPPORT", "mark_completed")).toBe(true);
    expect(allowed("SUPPORT", "blacklist")).toBe(false);
    expect(allowed("SUPPORT", "update_reward")).toBe(false);
  });

  it.each(["OWNER", "ADMIN"])("%s may use every action", (role) => {
    for (const action of ["retry_delivery", "mark_completed", "blacklist", "update_reward"]) {
      expect(allowed(role, action)).toBe(true);
    }
  });

  it("unknown roles get nothing", () => {
    expect(allowed("CUSTOMER", "retry_delivery")).toBe(false);
  });
});

describe("spin retry guard", () => {
  it("allows retry only after a failed or pending supplier delivery", () => {
    expect(isSpinRetryable({ status: "FAILED", fulfillmentStatus: null })).toBe(true);
    expect(isSpinRetryable({ status: "COMPLETED", fulfillmentStatus: "PENDING_DELIVERY" })).toBe(true);
    expect(isSpinRetryable({ status: "COMPLETED", fulfillmentStatus: "FAILED" })).toBe(true);
  });

  it("never retries delivered, manual, unclaimed or in-flight spins", () => {
    expect(isSpinRetryable({ status: "COMPLETED", fulfillmentStatus: "COMPLETED" })).toBe(false);
    expect(isSpinRetryable({ status: "COMPLETED", fulfillmentStatus: "DELIVERED" })).toBe(false);
    expect(isSpinRetryable({ status: "COMPLETED", fulfillmentStatus: "MANUALLY_COMPLETED" })).toBe(false);
    expect(isSpinRetryable({ status: "COMPLETED", fulfillmentStatus: "MANUAL_DELIVERY_REQUIRED" })).toBe(false);
    expect(isSpinRetryable({ status: "SPUN", fulfillmentStatus: null })).toBe(false);
    expect(isSpinRetryable({ status: "PENDING", fulfillmentStatus: null })).toBe(false);
    expect(isSpinRetryable({ status: "CLAIMING", fulfillmentStatus: "FAILED" })).toBe(false);
  });

  it("requires a paid order", () => {
    expect(isSpinOrderPaid("PAID")).toBe(true);
    expect(isSpinOrderPaid("DELIVERED")).toBe(true);
    expect(isSpinOrderPaid("PENDING")).toBe(false);
    expect(isSpinOrderPaid("REFUNDED")).toBe(false);
    expect(isSpinOrderPaid("CANCELLED")).toBe(false);
  });
});
