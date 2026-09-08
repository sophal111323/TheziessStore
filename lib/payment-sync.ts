import { prisma } from "@/lib/prisma";
import { fetchPaymentStatus } from "@/lib/payment";
import {
  isRemotePaid,
  logPaymentValidationFailure,
  validatePaymentForOrder,
} from "@/lib/payment-validation";
import { notifyAndMaybeDeliverPaidOrder } from "@/lib/order-fulfillment";

/**
 * Server-side payment synchronization and order confirmation.
 * Safely verifies payment with the gateway (Tola Saint) and transitions
 * order from PENDING to PAID, triggers automated supplier fulfillment,
 * and notifies Telegram.
 *
 * Fully idempotent: safe to call from background trackers, webhooks, or public sync.
 */
export async function syncAndConfirmOrderPayment(orderNumber: string): Promise<{
  paid: boolean;
  orderNumber: string;
  error?: string;
  status?: string;
}> {
  const normalized = String(orderNumber || "").trim().toUpperCase();
  if (!normalized) {
    return { paid: false, orderNumber: "", error: "Missing order number" };
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: normalized },
  });

  if (!order) {
    return { paid: false, orderNumber: normalized, error: "Order not found" };
  }

  // Already processed into a paid or delivered state
  if (order.status !== "PENDING") {
    return {
      paid:
        order.status === "PAID" ||
        order.status === "PROCESSING" ||
        order.status === "DELIVERED",
      orderNumber: normalized,
      status: order.status,
    };
  }

  if (!order.paymentRef || order.paymentRef.startsWith("SIM-")) {
    return {
      paid: false,
      orderNumber: normalized,
      error: "No real gateway payment reference",
    };
  }

  // Check if expired
  if (order.paymentExpiresAt && order.paymentExpiresAt.getTime() < Date.now()) {
    return {
      paid: false,
      orderNumber: normalized,
      status: "EXPIRED",
      error: "Payment expired",
    };
  }

  const remote = await fetchPaymentStatus(order.paymentRef);
  if (!remote) {
    return {
      paid: false,
      orderNumber: normalized,
      error: "Unable to fetch remote payment status",
    };
  }

  if (!isRemotePaid(remote)) {
    return {
      paid: false,
      orderNumber: normalized,
      status: remote.status,
    };
  }

  const validation = validatePaymentForOrder(order, {
    orderNumber: remote.orderNumber || order.orderNumber,
    transactionId: remote.transactionId ?? order.paymentRef,
    amount: remote.amount,
    currency: remote.currency,
    status: remote.status,
    paid: remote.paid,
  });

  if (!validation.ok) {
    logPaymentValidationFailure("internal_sync", validation);
    return {
      paid: false,
      orderNumber: normalized,
      error: validation.message,
    };
  }

  try {
    const updatedOrderId = await prisma.$transaction(async (tx: any) => {
      await tx.processedWebhookEvent.create({
        data: {
          transactionId: validation.transactionId,
          orderNumber: order.orderNumber,
          processedAt: new Date(),
        },
      });

      const updated = await tx.order.updateMany({
        where: {
          id: order.id,
          status: "PENDING",
          paymentRef: validation.transactionId,
        },
        data: {
          status: "PAID",
          paidAt: new Date(),
        },
      });

      if (updated.count !== 1) {
        throw new Error("Order already updated or status changed.");
      }

      return order.id;
    });

    // Trigger supplier top-up fulfillment and telegram alerts
    await notifyAndMaybeDeliverPaidOrder(updatedOrderId);

    return {
      paid: true,
      orderNumber: normalized,
      status: "PAID",
    };
  } catch (error: any) {
    if (error?.code === "P2002") {
      return {
        paid: true,
        orderNumber: normalized,
        status: "ALREADY_PROCESSED",
      };
    }
    console.error(`[payment-sync] Error confirming order ${normalized}:`, error);
    return {
      paid: false,
      orderNumber: normalized,
      error: String(error?.message || error),
    };
  }
}

