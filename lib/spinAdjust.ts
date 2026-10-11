import type { AdminPermission } from "@/lib/adminPermissions";

// Pure rules for POST /api/admin/spins/[id]/adjust (review R-1).

export type SpinAdjustAction =
  | "RETRY_DELIVERY"
  | "MARK_COMPLETED"
  | "UPDATE_REWARD"
  | "BLACKLIST";

export function normalizeSpinAdjustAction(raw: string): SpinAdjustAction | null {
  const value = String(raw || "").trim().toUpperCase();
  if (value === "RETRY_DELIVERY" || value === "RETRY") return "RETRY_DELIVERY";
  if (value === "MARK_COMPLETED") return "MARK_COMPLETED";
  if (value === "UPDATE_REWARD") return "UPDATE_REWARD";
  if (value === "BLACKLIST" || value === "BLACKLIST_USER") return "BLACKLIST";
  return null;
}

/** Permission each action needs, on top of route-level orders.update. */
export function spinAdjustPermission(action: SpinAdjustAction): AdminPermission {
  switch (action) {
    case "BLACKLIST":
      return "banlist.write";
    case "UPDATE_REWARD":
      return "randomPackages.write";
    default:
      return "orders.update";
  }
}

const PAID_ORDER_STATES = new Set(["PAID", "PROCESSING", "DELIVERED"]);
const RETRYABLE_FULFILLMENT = new Set(["FAILED", "PENDING_DELIVERY"]);

export function isSpinOrderPaid(orderStatus: string | null | undefined): boolean {
  return PAID_ORDER_STATES.has(String(orderStatus || "").toUpperCase());
}

/**
 * A supplier retry is only allowed when the previous delivery definitely did
 * not go through: the spin itself failed, or the claim recorded a failed /
 * pending supplier delivery. Delivered, manually completed, unclaimed or
 * in-flight (CLAIMING) spins never trigger another top-up.
 */
export function isSpinRetryable(spin: {
  status: string | null | undefined;
  fulfillmentStatus: string | null | undefined;
}): boolean {
  const status = String(spin.status || "").toUpperCase();
  const fulfillment = String(spin.fulfillmentStatus || "").toUpperCase();
  if (status === "CLAIMING") return false;
  if (RETRYABLE_FULFILLMENT.has(fulfillment)) return true;
  return status === "FAILED" && fulfillment === "";
}
