// Pure parser for JLA POST /api/check-payment-status (review R-5).
//
// JLA returns the upstream Payway status response. Documented approval
// signals (https://payway.jlastore.com/llms.txt): status.message === "approved"
// or data.action === "approved". ABA-style shapes may also carry
// data.payment_status / data.payment_currency. status.code "00" only means the
// status request itself succeeded (create-tran returns it for unpaid
// transactions too), so it is never treated as "paid" on its own.
//
// Identifiers are only reported when JLA actually echoes them. Nothing is
// filled with defaults, so buildRemoteSnapshotForValidation can tell "echoed
// and matching" from "absent".

import type { PaymentStatusResult } from "../types";

function str(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

const APPROVED_WORDS = new Set(["approved", "paid"]);
const FAILED_WORDS = new Set(["failed", "declined", "rejected", "cancelled", "canceled"]);
const KNOWN_WORDS = new Set([...APPROVED_WORDS, ...FAILED_WORDS, "expired", "pending"]);

export type JlaStatusParse = {
  result: PaymentStatusResult;
  /** Fields JLA did not return (used for fallback logging). */
  missing: { orderNumber: boolean; paywayTranId: boolean; currency: boolean };
  /** status.code "00" without any explicit payment status field. */
  statusCodeOnly: boolean;
};

export function parseJlaStatusResponse(data: unknown, queriedId: string): JlaStatusParse | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const inner = obj(root.data);
  const status = obj(root.status);
  const innerStatus = obj(inner.status);

  const candidates = [
    status.message,
    inner.action,
    typeof root.status === "string" ? root.status : undefined,
    innerStatus.message,
    typeof inner.status === "string" ? inner.status : undefined,
    inner.payment_status,
    root.payment_status,
    root.message,
  ]
    .map((value) => str(value).toLowerCase())
    .filter(Boolean);

  const failed = candidates.some((c) => FAILED_WORDS.has(c));
  const expired = candidates.includes("expired");
  const paid = !failed && !expired && candidates.some((c) => APPROVED_WORDS.has(c));
  const resolvedStatus = paid ? "PAID" : expired ? "EXPIRED" : failed ? "FAILED" : "PENDING";

  const statusCode = str(innerStatus.code || status.code);
  const statusCodeOnly =
    statusCode === "00" && !candidates.some((c) => KNOWN_WORDS.has(c));

  const amount =
    root.amount !== undefined
      ? String(root.amount)
      : inner.total_amount !== undefined
        ? String(inner.total_amount)
        : root.total_amount !== undefined
          ? String(root.total_amount)
          : undefined;

  const currency =
    str(root.currency || inner.currency || inner.payment_currency).toUpperCase() || undefined;

  // Our tran_id (= orderNumber) is echoed at the top level. status.tran_id is
  // Payway's id in JLA's documented responses; if it equals what we queried
  // it is our own id echoed back instead.
  const statusTranId = str(status.tran_id);
  const query = str(queriedId);
  const orderNumber =
    str(root.tran_id) || (statusTranId && statusTranId === query ? statusTranId : "") || undefined;
  const paywayTranId =
    str(root.payway_tran_id) || (statusTranId && statusTranId !== query ? statusTranId : "") || undefined;

  return {
    result: {
      status: resolvedStatus,
      paid,
      transactionId: paywayTranId,
      orderNumber,
      amount,
      currency,
      provider: "jla",
      queryId: query || undefined,
    },
    missing: {
      orderNumber: !orderNumber,
      paywayTranId: !paywayTranId,
      currency: !currency,
    },
    statusCodeOnly,
  };
}
