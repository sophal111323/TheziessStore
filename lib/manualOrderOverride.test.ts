import { describe, expect, it } from "vitest";
import {
  fulfillNeedsOwnerOverride,
  isUnpaidOrder,
  statusChangeNeedsOwnerOverride,
} from "@/lib/manualOrderOverride";

const paidAt = new Date("2026-10-01T00:00:00Z");

describe("isUnpaidOrder", () => {
  it("PENDING and REFUNDED are unpaid", () => {
    expect(isUnpaidOrder({ status: "PENDING" })).toBe(true);
    expect(isUnpaidOrder({ status: "REFUNDED", paidAt })).toBe(true);
  });

  it("FAILED/CANCELLED depend on paidAt", () => {
    expect(isUnpaidOrder({ status: "FAILED", paidAt: null })).toBe(true);
    expect(isUnpaidOrder({ status: "CANCELLED" })).toBe(true);
    expect(isUnpaidOrder({ status: "FAILED", paidAt })).toBe(false);
  });

  it("paid states are paid", () => {
    for (const status of ["PAID", "PROCESSING", "DELIVERED"]) {
      expect(isUnpaidOrder({ status })).toBe(false);
    }
  });
});

describe("statusChangeNeedsOwnerOverride (R-2)", () => {
  it("manual PAID always needs the owner", () => {
    expect(statusChangeNeedsOwnerOverride({ status: "PENDING" }, "PAID")).toBe(true);
    expect(statusChangeNeedsOwnerOverride({ status: "FAILED", paidAt }, "PAID")).toBe(true);
    expect(statusChangeNeedsOwnerOverride({ status: "PAID", paidAt }, "PAID")).toBe(false);
  });

  it("unpaid -> PROCESSING/DELIVERED needs the owner", () => {
    expect(statusChangeNeedsOwnerOverride({ status: "PENDING" }, "DELIVERED")).toBe(true);
    expect(statusChangeNeedsOwnerOverride({ status: "PENDING" }, "COMPLETED")).toBe(true);
    expect(statusChangeNeedsOwnerOverride({ status: "PENDING" }, "PROCESSING")).toBe(true);
    expect(statusChangeNeedsOwnerOverride({ status: "CANCELLED" }, "DELIVERED")).toBe(true);
    expect(statusChangeNeedsOwnerOverride({ status: "REFUNDED", paidAt }, "DELIVERED")).toBe(true);
  });

  it("paid orders can be delivered by staff", () => {
    expect(statusChangeNeedsOwnerOverride({ status: "PAID", paidAt }, "DELIVERED")).toBe(false);
    expect(statusChangeNeedsOwnerOverride({ status: "PROCESSING", paidAt }, "DELIVERED")).toBe(false);
    expect(statusChangeNeedsOwnerOverride({ status: "FAILED", paidAt }, "DELIVERED")).toBe(false);
  });

  it("moving to non-delivery statuses is not an override", () => {
    expect(statusChangeNeedsOwnerOverride({ status: "PENDING" }, "CANCELLED")).toBe(false);
    expect(statusChangeNeedsOwnerOverride({ status: "PAID", paidAt }, "FAILED")).toBe(false);
    expect(statusChangeNeedsOwnerOverride({ status: "PENDING" }, undefined)).toBe(false);
  });
});

describe("fulfillNeedsOwnerOverride (R-2)", () => {
  it("force on PENDING or DELIVERED needs the owner", () => {
    expect(fulfillNeedsOwnerOverride({ status: "PENDING" }, true)).toBe(true);
    expect(fulfillNeedsOwnerOverride({ status: "DELIVERED", paidAt, deliveredAt: paidAt }, true)).toBe(true);
  });

  it("without force PENDING/DELIVERED are skipped by fulfillment anyway", () => {
    expect(fulfillNeedsOwnerOverride({ status: "PENDING" }, false)).toBe(false);
    expect(fulfillNeedsOwnerOverride({ status: "DELIVERED", paidAt }, false)).toBe(false);
  });

  it("FAILED retry is open only for paid, never-delivered orders", () => {
    expect(fulfillNeedsOwnerOverride({ status: "FAILED", paidAt }, true)).toBe(false);
    expect(fulfillNeedsOwnerOverride({ status: "FAILED", paidAt }, false)).toBe(false);
    expect(fulfillNeedsOwnerOverride({ status: "FAILED", paidAt: null }, true)).toBe(true);
    expect(fulfillNeedsOwnerOverride({ status: "FAILED", paidAt, deliveredAt: paidAt }, false)).toBe(true);
  });

  it("PAID/PROCESSING delivery stays open", () => {
    expect(fulfillNeedsOwnerOverride({ status: "PAID", paidAt }, false)).toBe(false);
    expect(fulfillNeedsOwnerOverride({ status: "PAID", paidAt }, true)).toBe(false);
    expect(fulfillNeedsOwnerOverride({ status: "PROCESSING", paidAt }, true)).toBe(false);
  });
});
