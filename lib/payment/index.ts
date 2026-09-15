// lib/payment/index.ts
//
// Generic payment API. The rest of the app calls ONLY these functions —
// never the provider directly. Supports KHQR Pay (https://khqrpay.site)
// and Tola Saint (https://tolasaint.com).

import crypto from "crypto";
import { assertProductionPaymentConfig } from "@/lib/payment-validation";
import {
  initiateTolaSaintPayment,
  fetchTolaSaintStatus,
  verifyTolaSaintWebhookSignature,
  parseTolaSaintWebhookEvent,
} from "./providers/tola-saint";
import {
  initiateKhqrpayPayment,
  fetchKhqrpayStatus,
  verifyKhqrpayWebhookSignature,
  parseKhqrpayWebhookEvent,
  isKhqrpayConfigured,
} from "./providers/khqrpay";

// Re-export provider helpers used by route handlers (webhook parsing).
export { parseTolaSaintWebhookEvent } from "./providers/tola-saint";
export type { TolaSaintWebhookEvent } from "./providers/tola-saint";
export { parseKhqrpayWebhookEvent, fetchKhqrpayStatus } from "./providers/khqrpay";
export type { KhqrpayWebhookEvent } from "./providers/khqrpay";

import type {
  InitiatePaymentArgs,
  PaymentInitResult,
  PaymentMethod,
  PaymentStatusResult,
} from "./types";

export type {
  InitiatePaymentArgs,
  PaymentInitResult,
  PaymentMethod,
  PaymentStatusResult,
} from "./types";

function cleanEnv(value?: string): string {
  return (value || "").trim().replace(/^['"]|['"]$/g, "");
}

function cleanBaseUrl(value?: string): string {
  return cleanEnv(value).replace(/\/+$/, "");
}

/**
 * Determine the active payment gateway provider.
 * Priority:
 * 1. Explicit PAYMENT_PROVIDER env var ("khqrpay" or "tolasaint")
 * 2. If KHQRPAY_API_KEY is configured -> "khqrpay"
 * 3. Default -> "tolasaint"
 */
export function getActivePaymentProvider(): "khqrpay" | "tolasaint" {
  const configured = cleanEnv(process.env.PAYMENT_PROVIDER).toLowerCase();
  if (configured === "khqrpay") return "khqrpay";
  if (configured === "tolasaint") return "tolasaint";
  if (isKhqrpayConfigured()) return "khqrpay";
  return "tolasaint";
}

// ── Simulation mode (local development only) ─────────────────────────────────

export function isPaymentSimulationMode(): boolean {
  assertProductionPaymentConfig();
  return cleanEnv(process.env.PAYMENT_SIMULATION_MODE).toLowerCase() === "true";
}

export function isPaymentSimulationAllowed(): boolean {
  assertProductionPaymentConfig();
  return process.env.NODE_ENV !== "production" && isPaymentSimulationMode();
}

function getAppBaseUrl(): string {
  const configured = cleanBaseUrl(
    process.env.NEXT_PUBLIC_BASE_URL || process.env.PUBLIC_APP_URL
  );
  if (configured) return configured;

  const vercelUrl = cleanBaseUrl(process.env.VERCEL_URL);
  if (vercelUrl) return `https://${vercelUrl}`;

  return "http://localhost:3000";
}

function simulatePayment(args: InitiatePaymentArgs): PaymentInitResult {
  const ref = `SIM-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  const base = getAppBaseUrl();
  return {
    paymentRef: ref,
    redirectUrl: `${base}/api/payment/simulate?order=${encodeURIComponent(args.orderNumber)}&ref=${encodeURIComponent(ref)}&method=${encodeURIComponent(args.method)}`,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  };
}

// ── Generic provider API ─────────────────────────────────────────────────────

/**
 * Create a payment for an order.
 * The amount MUST be loaded server-side from the database order.
 */
export async function initiatePayment(
  args: InitiatePaymentArgs
): Promise<PaymentInitResult> {
  assertProductionPaymentConfig();

  if (isPaymentSimulationMode()) return simulatePayment(args);

  const provider = getActivePaymentProvider();

  if (provider === "khqrpay") {
    return initiateKhqrpayPayment(args);
  }

  // Otherwise route to Tola Saint
  return initiateTolaSaintPayment(args);
}

/**
 * Query the provider for the current status of a stored payment reference.
 * Returns null when there is nothing usable (simulation refs, config missing,
 * or remote errors) — callers must treat null as "unknown", never as "paid".
 */
export async function fetchPaymentStatus(
  transactionId: string
): Promise<PaymentStatusResult | null> {
  assertProductionPaymentConfig();

  if (!transactionId || transactionId.startsWith("SIM-")) return null;

  const isNumericRef = /^\d{6,20}$/.test(transactionId);
  const provider = getActivePaymentProvider();

  if (provider === "khqrpay" || isNumericRef) {
    const res = await fetchKhqrpayStatus(transactionId);
    if (res) return res;
    if (provider === "khqrpay") return null;
  }

  return fetchTolaSaintStatus(transactionId);
}

/**
 * Verify a webhook signature against the active provider.
 * Returns true only when the signature is valid per the provider's documented
 * algorithm. Never bypassed by simulation mode.
 */
export function verifyWebhook(
  method: PaymentMethod | string,
  rawBody: string,
  headers: Record<string, string>
): boolean {
  const norm = String(method || "").toUpperCase();
  const isSupported =
    norm === "KHQRPAY" ||
    norm === "TOLASAINT" ||
    norm === "ABA" ||
    norm === "BAKONG" ||
    norm === "KHQR" ||
    norm === "1";

  if (!isSupported) return false;

  const hasKhqrpayHeader = Boolean(
    headers["x-webhook-event"] ||
    headers["X-Webhook-Event"] ||
    headers["x-webhook-delivery"] ||
    headers["X-Webhook-Delivery"]
  );

  if (norm === "KHQRPAY" || hasKhqrpayHeader || getActivePaymentProvider() === "khqrpay") {
    return verifyKhqrpayWebhookSignature(headers, rawBody);
  }

  return verifyTolaSaintWebhookSignature(headers, rawBody);
}
