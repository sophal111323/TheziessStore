// lib/payment/index.ts
//
// PaymentService architecture managing:
//   1. KhqrPayProvider (https://khqrpay.site)
//   2. JlaPaywayProvider (https://payway.jlastore.com)
//
// Admin switches the active provider server-side.
// Customers never choose or control the provider.
// Old orders retain their original provider permanently for verification.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { assertProductionPaymentConfig } from "@/lib/payment-validation";
import {
  KhqrPayProvider,
  initiateKhqrpayPayment,
  fetchKhqrpayStatus,
  verifyKhqrpayWebhookSignature,
  parseKhqrpayWebhookEvent,
  isKhqrpayConfigured,
} from "./providers/khqrpay";
import {
  JlaPaywayProvider,
  initiateJlaPayment,
  fetchJlaStatus,
  verifyJlaWebhookSignature,
  parseJlaWebhookEvent,
  isJlaConfigured,
} from "./providers/jla";

// Re-export provider helpers
export {
  parseKhqrpayWebhookEvent,
  fetchKhqrpayStatus,
  KhqrPayProvider,
} from "./providers/khqrpay";
export type { KhqrpayWebhookEvent } from "./providers/khqrpay";

export {
  parseJlaWebhookEvent,
  fetchJlaStatus,
  JlaPaywayProvider,
} from "./providers/jla";

export { parseTolaSaintWebhookEvent } from "./providers/tola-saint";

import type {
  InitiatePaymentArgs,
  PaymentInitResult,
  PaymentMethod,
  PaymentStatusResult,
  PaymentProviderType,
  IPaymentProvider,
} from "./types";

export type {
  InitiatePaymentArgs,
  PaymentInitResult,
  PaymentMethod,
  PaymentStatusResult,
  PaymentProviderType,
  IPaymentProvider,
} from "./types";

function cleanEnv(value?: string): string {
  return (value || "").trim().replace(/^['"]|['"]$/g, "");
}

function cleanBaseUrl(value?: string): string {
  return cleanEnv(value).replace(/\/+$/, "");
}

// ── Payment Provider Abstraction ─────────────────────────────────────────────

export const PaymentService = {
  KhqrPayProvider,
  JlaPaywayProvider,

  getProvider(provider: PaymentProviderType): IPaymentProvider {
    if (provider === "jla") {
      return JlaPaywayProvider;
    }
    return KhqrPayProvider;
  },
};

// ── In-memory cache for active payment provider ──────────────────────────────
let cachedActiveProvider: PaymentProviderType | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5000; // 5-second TTL cache for DB provider lookup

export function invalidatePaymentProviderCache(): void {
  cachedActiveProvider = null;
  cacheExpiresAt = 0;
}

/**
 * Determine the active payment gateway provider.
 * The active provider is controlled strictly in Admin Panel and stored
 * in the database (prisma.settings.paymentProvider).
 *
 * Allowed values strictly: "khqrpay" | "jla".
 * Falls back to PAYMENT_PROVIDER env var or "khqrpay".
 */
export async function getActivePaymentProvider(): Promise<PaymentProviderType> {
  const now = Date.now();
  if (cachedActiveProvider && now < cacheExpiresAt) {
    return cachedActiveProvider;
  }

  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 1 },
      select: { paymentProvider: true },
    });

    const dbVal = String(settings?.paymentProvider || "").trim().toLowerCase();
    if (dbVal === "jla") {
      cachedActiveProvider = "jla";
      cacheExpiresAt = now + CACHE_TTL_MS;
      return "jla";
    }

    if (dbVal === "khqrpay") {
      cachedActiveProvider = "khqrpay";
      cacheExpiresAt = now + CACHE_TTL_MS;
      return "khqrpay";
    }
  } catch (err) {
    console.warn("[payment] Failed to load provider from DB settings, falling back to env:", err);
  }

  const envVal = cleanEnv(process.env.PAYMENT_PROVIDER).toLowerCase();
  if (envVal === "jla") {
    cachedActiveProvider = "jla";
  } else {
    cachedActiveProvider = "khqrpay";
  }
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedActiveProvider;
}

/**
 * Synchronous provider resolver using memory cache or environment fallback.
 */
export function getActivePaymentProviderSync(): PaymentProviderType {
  if (cachedActiveProvider && Date.now() < cacheExpiresAt) {
    return cachedActiveProvider;
  }
  const envVal = cleanEnv(process.env.PAYMENT_PROVIDER).toLowerCase();
  return envVal === "jla" ? "jla" : "khqrpay";
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
    provider: "khqrpay",
  };
}

// ── Generic Provider API ─────────────────────────────────────────────────────

/**
 * Create a payment for an order.
 * If forceProvider is specified (e.g. refreshing an existing order), that provider
 * is used. Otherwise, the current active provider chosen by the Admin is used.
 */
export async function initiatePayment(
  args: InitiatePaymentArgs,
  forceProvider?: PaymentProviderType
): Promise<PaymentInitResult> {
  assertProductionPaymentConfig();

  if (isPaymentSimulationMode()) return simulatePayment(args);

  const provider = forceProvider || (await getActivePaymentProvider());

  if (provider === "jla") {
    return JlaPaywayProvider.initiatePayment(args);
  }

  return KhqrPayProvider.initiatePayment(args);
}

/**
 * Query the payment provider for the current status of a stored payment reference.
 * If providerHint is provided (from the order's stored payment_provider), it verifies
 * against THAT specific provider, preventing admin switches from breaking old orders.
 */
export async function fetchPaymentStatus(
  transactionId: string,
  providerHint?: string | null
): Promise<PaymentStatusResult | null> {
  assertProductionPaymentConfig();

  if (!transactionId || transactionId.startsWith("SIM-")) return null;

  const normalizedHint = String(providerHint || "").trim().toLowerCase();

  // If order explicitly recorded JLA, verify with JLA only
  if (normalizedHint === "jla") {
    return JlaPaywayProvider.fetchStatus(transactionId);
  }

  // If order explicitly recorded KHQRPay, verify with KHQRPay only
  if (normalizedHint === "khqrpay") {
    return KhqrPayProvider.fetchStatus(transactionId);
  }

  // If no providerHint was stored (e.g. legacy order), try active provider then fallback
  const active = await getActivePaymentProvider();
  if (active === "jla") {
    const jlaRes = await JlaPaywayProvider.fetchStatus(transactionId);
    if (jlaRes) return jlaRes;
    return KhqrPayProvider.fetchStatus(transactionId);
  }

  const khqrRes = await KhqrPayProvider.fetchStatus(transactionId);
  if (khqrRes) return khqrRes;
  return JlaPaywayProvider.fetchStatus(transactionId);
}

/**
 * Verify a webhook signature against the appropriate provider.
 */
export function verifyWebhook(
  method: PaymentMethod | string,
  rawBody: string,
  headers: Record<string, string>
): boolean {
  const norm = String(method || "").toUpperCase();
  const isSupported =
    norm === "KHQRPAY" ||
    norm === "JLA" ||
    norm === "TOLASAINT" ||
    norm === "ABA" ||
    norm === "BAKONG" ||
    norm === "KHQR" ||
    norm === "1";

  if (!isSupported) return false;

  if (norm === "JLA") {
    return JlaPaywayProvider.verifyWebhook(rawBody, headers);
  }

  const hasKhqrpayHeader = Boolean(
    headers["x-webhook-event"] ||
    headers["X-Webhook-Event"] ||
    headers["x-webhook-delivery"] ||
    headers["X-Webhook-Delivery"]
  );

  if (norm === "KHQRPAY" || hasKhqrpayHeader) {
    return KhqrPayProvider.verifyWebhook(rawBody, headers);
  }

  // Default to active provider
  const active = getActivePaymentProviderSync();
  if (active === "jla") {
    return JlaPaywayProvider.verifyWebhook(rawBody, headers);
  }

  return KhqrPayProvider.verifyWebhook(rawBody, headers);
}
