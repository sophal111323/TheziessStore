// Pure rules for admin actions that would deliver goods without a confirmed
// payment, or deliver an already delivered order again (review R-2).
// These require the OWNER role plus confirmManualPaid:true, and are always
// audited and alerted. Client-safe: no server imports.

type OrderLike = {
  status: string | null | undefined;
  paidAt?: Date | string | null;
  deliveredAt?: Date | string | null;
};

const PAID_STATES = new Set(["PAID", "PROCESSING", "DELIVERED"]);

function upper(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

/**
 * True when the order is not (or no longer) backed by a payment.
 * Every payment confirmation path sets paidAt, so a FAILED/CANCELLED order
 * without paidAt was never paid. PENDING and REFUNDED are always unpaid.
 */
export function isUnpaidOrder(order: OrderLike): boolean {
  const status = upper(order.status);
  if (PAID_STATES.has(status)) return false;
  if (status === "PENDING" || status === "REFUNDED") return true;
  return !order.paidAt;
}

/** PATCH status change that needs OWNER + confirmManualPaid. */
export function statusChangeNeedsOwnerOverride(
  order: OrderLike,
  nextStatus: string | null | undefined
): boolean {
  const from = upper(order.status);
  const to = upper(nextStatus === "COMPLETED" ? "DELIVERED" : nextStatus);
  if (!to || to === from) return false;
  if (to === "PAID") return true;
  if (to === "PROCESSING" || to === "DELIVERED") return isUnpaidOrder(order);
  return false;
}

/**
 * Supplier top-up (fulfillPaidOrder) that needs OWNER + confirmManualPaid:
 *  - force on PENDING (marks it PAID, then tops up),
 *  - force on DELIVERED (tops up again),
 *  - retry of a FAILED order that was never paid or was already delivered.
 * Retrying a paid, never-delivered FAILED order and delivering PAID orders
 * stay open to ADMIN/SUPPORT.
 */
export function fulfillNeedsOwnerOverride(order: OrderLike, force: boolean): boolean {
  const status = upper(order.status);
  if (status === "PENDING" || status === "DELIVERED") return force;
  if (status === "FAILED") return isUnpaidOrder(order) || Boolean(order.deliveredAt);
  return false;
}
