import { prisma } from "@/lib/prisma";
import { refreshTopupStatus } from "@/lib/fulfillment";
import { syncAndConfirmOrderPayment } from "@/lib/payment-sync";

/**
 * In-memory set of order numbers currently being actively polled for delivery.
 */
const activeTrackingOrders = new Set<string>();

/**
 * In-memory set of order numbers currently being actively polled for payment.
 */
const activePaymentOrders = new Set<string>();

/**
 * Delivery polling schedule (delays in ms between supplier checks).
 * Starts quickly (3s, 5s) to catch instant deliveries, then gradually expands.
 * Total duration: ~6.7 minutes across 11 checks.
 */
const SCHEDULE_DELAYS_MS = [
  3000,
  5000,
  7000,
  10000,
  15000,
  20000,
  30000,
  45000,
  60000,
  90000,
  120000,
];

/**
 * Payment polling schedule (delays in ms between payment gateway checks).
 * Polls every 4-8s initially, then up to 5 minutes (standard KHQR expiry).
 */
const PAYMENT_SCHEDULE_DELAYS_MS = [
  4000,
  5000,
  6000,
  8000,
  10000,
  12000,
  15000,
  20000,
  25000,
  30000,
  40000,
  50000,
  60000,
  75000,
  90000,
  120000,
];

/**
 * Start an automated background tracking loop for an order that is in PROCESSING status.
 *
 * It checks the upstream supplier API at progressive intervals:
 * - When the supplier completes delivery, refreshTopupStatus() updates the order
 *   status to DELIVERED and triggers the "✅ Topup DELIVERED" Telegram notification.
 * - If the order transitions to any other status (DELIVERED/FAILED/CANCELLED) by a
 *   webhook, customer visit, or admin action, the tracker terminates immediately.
 * - Thread-safe and idempotent: only one tracker runs per order number at any time.
 */
export function startBackgroundOrderTracker(orderNumber: string): void {
  const clean = String(orderNumber || "").trim().toUpperCase();
  if (!clean) return;

  if (activeTrackingOrders.has(clean)) {
    return;
  }

  activeTrackingOrders.add(clean);

  const runTracker = async () => {
    try {
      for (const delay of SCHEDULE_DELAYS_MS) {
        await new Promise((resolve) => setTimeout(resolve, delay));

        // 1. Verify order still exists and is still PROCESSING
        const order = await prisma.order.findUnique({
          where: { orderNumber: clean },
          select: { id: true, status: true, topupProviderRef: true },
        });

        if (!order) {
          break;
        }

        // If another process or webhook already delivered or failed the order, stop.
        if (order.status !== "PROCESSING") {
          break;
        }

        if (!order.topupProviderRef) {
          break;
        }

        // 2. Query supplier status and update order + notify telegram if completed
        try {
          const result = await refreshTopupStatus(clean);

          if (
            result.success &&
            (result.status === "success" || result.status === "completed")
          ) {
            // Order is DELIVERED and Telegram notification was sent!
            break;
          }

          if (result.status === "failed") {
            // Order failed at supplier and Telegram notification was sent!
            break;
          }
        } catch (refreshErr) {
          console.warn(`[order-tracker] Error refreshing ${clean}:`, refreshErr);
        }
      }
    } catch (err) {
      console.error(`[order-tracker] Unexpected tracking error for ${clean}:`, err);
    } finally {
      activeTrackingOrders.delete(clean);
    }
  };

  // Kick off tracker in background without awaiting
  runTracker().catch((err) => {
    console.error(`[order-tracker] Unhandled tracker error for ${clean}:`, err);
    activeTrackingOrders.delete(clean);
  });
}

/**
 * Start an automated background payment tracking loop for an order with a KHQR code (PENDING).
 *
 * Runs completely server-side, so even if the user closes their browser tab or switches apps,
 * the server automatically detects when payment arrives at the gateway, transitions the order
 * to PAID, initiates fulfillment with the supplier API, and sends Telegram alerts.
 */
export function startBackgroundPaymentTracker(orderNumber: string): void {
  const clean = String(orderNumber || "").trim().toUpperCase();
  if (!clean) return;

  if (activePaymentOrders.has(clean)) {
    return;
  }

  activePaymentOrders.add(clean);

  const runPaymentTracker = async () => {
    try {
      for (const delay of PAYMENT_SCHEDULE_DELAYS_MS) {
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Verify order still exists and is PENDING
        const order = await prisma.order.findUnique({
          where: { orderNumber: clean },
          select: {
            id: true,
            status: true,
            paymentRef: true,
            paymentExpiresAt: true,
          },
        });

        if (!order) break;

        // If already paid (by webhook, checkout page, or admin), stop payment tracking
        if (order.status !== "PENDING") break;

        if (!order.paymentRef || order.paymentRef.startsWith("SIM-")) break;

        if (order.paymentExpiresAt && order.paymentExpiresAt.getTime() < Date.now()) {
          break;
        }

        // Check gateway and confirm payment if completed
        try {
          const res = await syncAndConfirmOrderPayment(clean);
          if (res.paid) {
            // Payment succeeded! Post-payment fulfillment has been triggered.
            break;
          }
        } catch (err) {
          console.warn(`[payment-tracker] Error checking payment for ${clean}:`, err);
        }
      }
    } catch (err) {
      console.error(`[payment-tracker] Unexpected payment error for ${clean}:`, err);
    } finally {
      activePaymentOrders.delete(clean);
    }
  };

  runPaymentTracker().catch((err) => {
    console.error(`[payment-tracker] Unhandled error for ${clean}:`, err);
    activePaymentOrders.delete(clean);
  });
}

/**
 * Sweep any lingering PROCESSING orders that were created within the last 2 hours.
 * Useful for cron jobs or recovering after server restarts.
 */
export async function sweepProcessingOrders(): Promise<{
  checked: number;
  resolved: number;
}> {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: "PROCESSING",
      topupProviderRef: { not: null },
      createdAt: { gte: cutoff },
    },
    select: { orderNumber: true },
    take: 20,
  });

  let resolved = 0;

  for (const o of orders) {
    try {
      const res = await refreshTopupStatus(o.orderNumber);
      if (
        res.success &&
        (res.status === "success" ||
          res.status === "completed" ||
          res.status === "failed")
      ) {
        resolved++;
      }
    } catch (err) {
      console.warn(`[sweepProcessingOrders] Error refreshing ${o.orderNumber}:`, err);
    }
  }

  return { checked: orders.length, resolved };
}

/**
 * Sweep any pending orders from the last 15 minutes that have a real payment reference
 * to ensure payment isn't missed even if webhook or browser tab failed.
 */
export async function sweepPendingOrders(): Promise<{
  checked: number;
  paidCount: number;
}> {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      paymentRef: { not: null },
      createdAt: { gte: cutoff },
    },
    select: { orderNumber: true, paymentRef: true },
    take: 20,
  });

  let paidCount = 0;

  for (const o of orders) {
    if (o.paymentRef && !o.paymentRef.startsWith("SIM-")) {
      try {
        const res = await syncAndConfirmOrderPayment(o.orderNumber);
        if (res.paid) paidCount++;
      } catch (err) {
        console.warn(`[sweepPendingOrders] Error checking payment ${o.orderNumber}:`, err);
      }
    }
  }

  return { checked: orders.length, paidCount };
}
