// lib/payment/providers/khqrpay.ts
//
// KHQR Pay adapter for https://khqrpay.site
// Official API reference:
//   - Base URL:   https://khqrpay.site
//   - Auth:       Authorization: Bearer sk_...
//   - Create ABA: POST /api/v1/aba/create   -> { ok, code, id, type, amount, status, qr, checkout_url, expires_at, ttl_ms }
//   - Status:     GET  /api/v1/payment?id=  -> { ok, code, payment: { id, type, status, amount, expires_at } }
//   - Statuses:   Pending | Paid | Expired | Failed | UnderPaid
//   - Webhook:    POST with { event: "payment.update", id, type, status, amount, time }
//                 Optional header: X-Webhook-Signature (sha256=<hex>)

import crypto from "crypto";
import dns from "dns";
import type {
  InitiatePaymentArgs,
  PaymentInitResult,
  PaymentStatusResult,
} from "../types";

// Ensure Node connects using IPv4 first to match the whitelisted IPv4 address (e.g. 94.237.75.87)
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

const KHQRPAY_BASE =
  cleanBaseUrl(process.env.KHQRPAY_BASE_URL) || "https://khqrpay.site";

export function getKhqrpayApiKey(): string {
  return cleanEnv(process.env.KHQRPAY_API_KEY);
}

export function isKhqrpayConfigured(): boolean {
  return Boolean(getKhqrpayApiKey());
}

export function normalizeKhqrpayStatus(
  value: unknown
): "pending" | "paid" | "expired" | "failed" | "underpaid" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "paid") return "paid";
  if (raw === "expired") return "expired";
  if (raw === "failed") return "failed";
  if (raw === "underpaid") return "underpaid";
  return "pending";
}

/**
 * Initiate an ABA KHQR payment via https://khqrpay.site/api/v1/aba/create
 */
export async function initiateKhqrpayPayment(
  args: InitiatePaymentArgs
): Promise<PaymentInitResult> {
  const apiKey = getKhqrpayApiKey();
  if (!apiKey) {
    throw new Error("KHQRPAY_API_KEY is not configured.");
  }

  const amountUsd = Number(args.amountUsd.toFixed(2));
  if (amountUsd < 0.01 || amountUsd > 10000) {
    throw new Error(`Invalid payment amount: $${args.amountUsd}. Must be between 0.01 and 10000.`);
  }

  const payload: Record<string, unknown> = {
    amount: amountUsd,
  };

  if (args.callbackUrl && !args.callbackUrl.includes("localhost")) {
    payload.webhook = args.callbackUrl;
  }

  const endpoint = `${KHQRPAY_BASE}/api/v1/aba/create`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
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
    throw new Error(`KHQR Pay returned non-JSON response (HTTP ${res.status}): ${bodyText.slice(0, 150)}`);
  }

  if (!res.ok || !data?.ok || data?.code !== 0) {
    const errorMsg = data?.error_text || data?.msg || data?.error || `HTTP ${res.status}`;
    throw new Error(`KHQR Pay error: ${errorMsg}`);
  }

  const paymentRef = String(data.id);
  const qrString = String(data.qr || "");
  const redirectUrl = String(data.checkout_url || `${KHQRPAY_BASE}/pay/${paymentRef}`);

  let expiresAt: Date;
  if (data.expires_at) {
    expiresAt = new Date(data.expires_at);
  } else if (data.ttl_ms) {
    expiresAt = new Date(Date.now() + Number(data.ttl_ms));
  } else {
    // ABA PayWay standard lifetime is 180 seconds (3 minutes)
    expiresAt = new Date(Date.now() + 180 * 1000);
  }

  return {
    paymentRef,
    redirectUrl,
    qrString,
    expiresAt,
  };
}

/**
 * Check payment status via GET https://khqrpay.site/api/v1/payment?id={id}
 */
export async function fetchKhqrpayStatus(
  transactionId: string
): Promise<PaymentStatusResult | null> {
  const apiKey = getKhqrpayApiKey();
  if (!apiKey || !transactionId) return null;

  const endpoint = `${KHQRPAY_BASE}/api/v1/payment?id=${encodeURIComponent(transactionId)}`;

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (!data?.ok || !data?.payment) {
      return null;
    }

    const payment = data.payment;
    const rawStatus = String(payment.status || "").trim();
    const normalized = normalizeKhqrpayStatus(rawStatus);

    return {
      status: normalized.toUpperCase(),
      paid: normalized === "paid",
      transactionId: String(payment.id),
      amount: String(payment.amount),
      currency: String(payment.currency || "USD").toUpperCase(),
    };
  } catch (err) {
    console.error("[khqrpay] fetchKhqrpayStatus error:", err);
    return null;
  }
}

/**
 * Verify webhook signature if KHQRPAY_WEBHOOK_SECRET is set.
 */
export function verifyKhqrpayWebhookSignature(
  headers: Record<string, string>,
  rawBody: string
): boolean {
  const secret = cleanEnv(process.env.KHQRPAY_WEBHOOK_SECRET);
  if (!secret) {
    // If no secret configured in env, signature check is not enforced.
    // The webhook handler will perform server-to-server confirmation against fetchKhqrpayStatus.
    return true;
  }

  const sigHeader =
    headers["x-webhook-signature"] ||
    headers["X-Webhook-Signature"] ||
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

export type KhqrpayWebhookEvent = {
  event: string;
  id: string;
  type: string;
  status: "paid" | "expired" | "failed" | "underpaid" | "pending";
  amount?: string;
  time?: string;
};

export function parseKhqrpayWebhookEvent(payload: any): KhqrpayWebhookEvent | null {
  if (!payload || typeof payload !== "object") return null;

  const id = payload.id !== undefined && payload.id !== null ? String(payload.id).trim() : "";
  if (!id) return null;

  const status = normalizeKhqrpayStatus(payload.status);

  return {
    event: String(payload.event || "payment.update"),
    id,
    type: String(payload.type || "aba"),
    status,
    amount: payload.amount !== undefined ? String(payload.amount) : undefined,
    time: payload.time ? String(payload.time) : undefined,
  };
}
