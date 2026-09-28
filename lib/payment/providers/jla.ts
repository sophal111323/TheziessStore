// lib/payment/providers/jla.ts
//
// JLA Payway adapter for https://payway.jlastore.com
// Official API reference (https://payway.jlastore.com/llms.txt):
//   - Base URL:           https://payway.jlastore.com
//   - Create Tran:        POST /api/create-tran
//                         Payload: { amount, aba_data, tran_id, continue_url, cancel_url, webhook }
//                         Response: { success, tran_id, payway_tran_id, checkout_url, deeplink, data: { status, qr_string } }
//   - Check Status:       POST /api/check-payment-status
//                         Payload: { tran_id }
//                         Response: upstream Payway response or { status, data }
//   - Webhook:            POST with { status: "approved", tran_id, payway_tran_id, amount, date, download_receipt }
//
// Security Constraints:
//   - ABA_DATA must NEVER be returned to the client or exposed to frontend code.
//   - process.env.ABA_DATA is server-side only.

import crypto from "crypto";
import dns from "dns";
import type {
  InitiatePaymentArgs,
  PaymentInitResult,
  PaymentStatusResult,
  NormalizedWebhookEvent,
  IPaymentProvider,
} from "../types";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Ignore in environments where setDefaultResultOrder is not supported
}

function cleanEnv(value?: string): string {
  return (value || "").trim().replace(/^['"]|['"]$/g, "");
}

function cleanBaseUrl(value?: string): string {
  return cleanEnv(value).replace(/\/+$/, "");
}

const JLA_BASE =
  cleanBaseUrl(process.env.PAYWAY_BASE_URL) || "https://payway.jlastore.com";

export function getJlaAbaData(): string {
  return cleanEnv(process.env.ABA_DATA);
}

export function isJlaConfigured(): boolean {
  return Boolean(getJlaAbaData());
}

/**
 * Initiate a payment via JLA Payway POST /api/create-tran
 */
export async function initiateJlaPayment(
  args: InitiatePaymentArgs
): Promise<PaymentInitResult> {
  const abaData = getJlaAbaData();
  if (!abaData) {
    throw new Error(
      "ABA_DATA is not configured on the server. Please configure ABA_DATA in environment variables."
    );
  }

  const rawAmount = args.amountUsd ?? (args as any).amount ?? 0;
  const amountUsd = Number(Number(rawAmount).toFixed(2));
  if (amountUsd < 0.01 || amountUsd > 10000) {
    throw new Error(
      `Invalid payment amount: $${rawAmount}. Must be between 0.01 and 10000.`
    );
  }

  const payload: Record<string, unknown> = {
    amount: amountUsd.toFixed(2),
    aba_data: abaData,
    tran_id: args.orderNumber,
  };

  if (args.returnUrl) {
    payload.continue_url = args.returnUrl;
  }
  if (args.cancelUrl) {
    payload.cancel_url = args.cancelUrl;
  }
  if (args.callbackUrl && !args.callbackUrl.includes("localhost")) {
    payload.webhook = args.callbackUrl;
  }

  const endpoint = `${JLA_BASE}/api/create-tran`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const bodyText = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new Error(
      `JLA Payway returned non-JSON response (HTTP ${res.status}): ${bodyText.slice(0, 150)}`
    );
  }

  if (!res.ok || data?.error || (data?.success === false && !data?.reused)) {
    const errorMsg =
      data?.error || data?.message || data?.msg || `HTTP ${res.status}`;
    throw new Error(`JLA Payway error: ${errorMsg}`);
  }

  // JLA returns:
  // - payway_tran_id: Payway's internal ID
  // - tran_id: our supplied orderNumber
  // - checkout_url: absolute URL
  // - deeplink: abamobilebank://...
  // - data.qr_string: raw KHQR payload
  const paymentRef = String(
    data.payway_tran_id || data.tran_id || args.orderNumber
  );
  const qrString = String(data?.data?.qr_string || data?.qr_string || "");
  const deeplink = data?.deeplink ? String(data.deeplink) : undefined;
  const redirectUrl = String(
    data?.checkout_url || `${JLA_BASE}/checkout/${encodeURIComponent(args.orderNumber)}`
  );

  // Payway QR checkout sessions expire after 3 minutes (180s)
  const expiresAt = new Date(Date.now() + 180 * 1000);

  return {
    paymentRef,
    redirectUrl,
    qrString,
    deeplink,
    expiresAt,
    provider: "jla",
  };
}

/**
 * Check payment status via POST /api/check-payment-status
 */
export async function fetchJlaStatus(
  transactionId: string
): Promise<PaymentStatusResult | null> {
  if (!transactionId) return null;

  const endpoint = `${JLA_BASE}/api/check-payment-status`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ tran_id: transactionId }),
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json().catch(() => null);
    if (!data) return null;

    // Check upstream response indicators documented in llms.txt:
    // data.status?.message === "approved" || data.data?.action === "approved"
    // or status: "approved"
    const statusMsg = String(
      data?.status?.message ||
        data?.data?.action ||
        data?.status ||
        data?.data?.status?.message ||
        data?.message ||
        ""
    ).toLowerCase();

    const statusCode = String(
      data?.data?.status?.code || data?.status?.code || ""
    );

    const paid =
      statusMsg === "approved" ||
      statusMsg === "paid" ||
      statusCode === "00";

    const amount =
      data?.amount !== undefined
        ? String(data.amount)
        : data?.data?.total_amount !== undefined
          ? String(data.data.total_amount)
          : data?.total_amount !== undefined
            ? String(data.total_amount)
            : undefined;

    const currency = String(
      data?.currency || data?.data?.currency || "USD"
    ).toUpperCase();

    const resolvedStatus = paid
      ? "PAID"
      : statusMsg === "expired"
        ? "EXPIRED"
        : statusMsg === "failed" || statusMsg === "declined"
          ? "FAILED"
          : "PENDING";

    return {
      status: resolvedStatus,
      paid,
      transactionId: String(data?.payway_tran_id || data?.tran_id || transactionId),
      orderNumber: String(data?.tran_id || transactionId),
      amount,
      currency,
      provider: "jla",
    };
  } catch (err) {
    console.error("[jla] fetchJlaStatus error:", err);
    return null;
  }
}

/**
 * Verify webhook signature if JLA_WEBHOOK_SECRET is set.
 */
export function verifyJlaWebhookSignature(
  headers: Record<string, string>,
  rawBody: string
): boolean {
  const secret = cleanEnv(process.env.JLA_WEBHOOK_SECRET);
  if (!secret) {
    // If no secret configured, signature check is not enforced.
    // The webhook handler verifies transaction legitimacy with fetchJlaStatus directly.
    return true;
  }

  const sigHeader =
    headers["x-webhook-signature"] ||
    headers["X-Webhook-Signature"] ||
    headers["x-signature"] ||
    headers["X-Signature"] ||
    "";

  if (!sigHeader) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(sigHeader, "utf8"),
      Buffer.from(expected, "utf8")
    );
  } catch {
    return false;
  }
}

/**
 * Parse incoming webhook payload from JLA Payway.
 * Payload example:
 * {
 *   "status": "approved",
 *   "tran_id": "ORD-1234",
 *   "payway_tran_id": "178392699651531",
 *   "real_tran_id": "PAYWAY_TRANSACTION_ID",
 *   "amount": "0.10",
 *   "date": "20260713083022"
 * }
 */
export function parseJlaWebhookEvent(payload: any): NormalizedWebhookEvent | null {
  if (!payload || typeof payload !== "object") return null;

  const orderNumber = payload.tran_id !== undefined ? String(payload.tran_id).trim() : "";
  const transactionId = String(
    payload.payway_tran_id || payload.real_tran_id || payload.tran_id || ""
  ).trim();

  if (!transactionId && !orderNumber) return null;

  const rawStatus = String(payload.status || "").trim().toLowerCase();
  const status: "paid" | "expired" | "failed" | "pending" =
    rawStatus === "approved" || rawStatus === "paid"
      ? "paid"
      : rawStatus === "expired"
        ? "expired"
        : rawStatus === "failed" || rawStatus === "declined"
          ? "failed"
          : "pending";

  const amount = payload.amount !== undefined ? String(payload.amount).trim() : undefined;

  return {
    event: "jla.payment",
    orderNumber: orderNumber || undefined,
    transactionId: transactionId || orderNumber,
    status,
    amount,
    currency: "USD",
    rawPayload: payload,
  };
}

export const JlaPaywayProvider: IPaymentProvider = {
  name: "jla",
  initiatePayment: initiateJlaPayment,
  fetchStatus: fetchJlaStatus,
  verifyWebhook: (rawBody, headers) => verifyJlaWebhookSignature(headers, rawBody),
  parseWebhookEvent: parseJlaWebhookEvent,
};
