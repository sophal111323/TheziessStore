import { prisma } from "@/lib/prisma";
import { fetchPaymentStatus } from "@/lib/payment";
import {
  buildRemoteSnapshotForValidation,
  isRemotePaid,
  logPaymentValidationFailure,
  validatePaymentForOrder,
} from "@/lib/payment-validation";
import { notifyAndMaybeDeliverPaidOrder } from "@/lib/order-fulfillment";

export type SyncAndConfirmOptions = {
  /** Who asked for the sync; used in validation-failure logs. */
  source?: "webhook" | "internal_sync";
  /**
   * Skip the local paymentExpiresAt cut-off. Used when a signed webhook says
   * "paid": the gateway is still queried and validated, but a late delivery
   * must not drop a real payment.
   */
  ignoreExpiry?: boolean;
};

/**
 * Server-side payment synchronization and order confirmation.
 * Safely verifies payment with the gateway (Tola Saint) and transitions
 * order from PENDING to PAID, triggers automated supplier fulfillment,
 * and notifies Telegram.
 *
 * Fully idempotent: safe to call from background trackers, webhooks, or public sync.
 */
export async function syncAndConfirmOrderPayment(
  orderNumber: string,
  opts: SyncAndConfirmOptions = {}
): Promise<{
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
  if (
    !opts.ignoreExpiry &&
    order.paymentExpiresAt &&
    order.paymentExpiresAt.getTime() < Date.now()
  ) {
    return {
      paid: false,
      orderNumber: normalized,
      status: "EXPIRED",
      error: "Payment expired",
    };
  }

  const remote = await fetchPaymentStatus(
    order.paymentRef,
    order.paymentProvider,
    order.orderNumber
  );
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

  const validation = validatePaymentForOrder(
    order,
    buildRemoteSnapshotForValidation(order, remote)
  );

  if (!validation.ok) {
    logPaymentValidationFailure(opts.source ?? "internal_sync", validation);
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

