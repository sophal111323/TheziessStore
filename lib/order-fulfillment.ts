import { prisma } from "@/lib/prisma";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";
import { fulfillPaidOrder } from "@/lib/fulfillment";
import { getSupplier } from "@/lib/topup";
import { startBackgroundOrderTracker } from "@/lib/order-tracker";
import { markAffiliateOrderCompleted } from "@/lib/affiliate/store";
import { extractRedeemCode } from "@/lib/redeem";
import { consumeOrderCouponAtomically } from "@/lib/coupon";
import { generateOrderToken } from "@/lib/orderToken";
import {
  sendOrderPaidTelegramAlert,
  sendSpinOrderPaidTelegramAlert,
  updateOrderDeliveryTelegramAlert,
} from "@/lib/telegram-order-notification";

/**
 * Runs post-payment work after an order safely transitions to PAID.
 *
 * Executes supplier top-up fulfillment and sends ONE SINGLE comprehensive
 * Telegram notification containing both payment details and fulfillment result.
 */
export async function notifyAndMaybeDeliverPaidOrder(orderId: string) {
  const fullOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: { game: true, product: true, randomPackage: true },
  });

  if (!fullOrder) return null;

  // ── Promoter attribution: mark affiliate order completed ($0.04 credited)
  try {
    markAffiliateOrderCompleted(fullOrder.orderNumber);
  } catch (err) {
    console.error("Failed to mark affiliate order completed:", err);
  }

  // ── Random Spin / Mystery Box Order ────────────────────────────────────────
  // When an order is a random spin, payment is confirmed, but reward delivery
  // must wait until the user spins the wheel and clicks Claim.
  if (fullOrder.isRandomSpin && fullOrder.randomPackageId) {
    await prisma.randomSpinTransaction.upsert({
      where: { orderId: fullOrder.id },
      create: {
        orderId: fullOrder.id,
        orderNumber: fullOrder.orderNumber,
        packageId: fullOrder.randomPackageId,
        gameId: fullOrder.gameId,
        playerUid: fullOrder.playerUid,
        serverId: fullOrder.serverId,
        playerNickname: fullOrder.playerNickname,
        status: "PENDING",
      },
      update: {},
    });

    const baseUrl =
      process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
    let spinUrl = "";
    if (baseUrl) {
      try {
        const spinToken = generateOrderToken(fullOrder.orderNumber);
        spinUrl = `${baseUrl}/spin/${fullOrder.orderNumber}?token=${spinToken}`;
      } catch {
        // Order-token secret missing: omit the link rather than send one that 404s.
        spinUrl = "";
      }
    }

    await sendSpinOrderPaidTelegramAlert(fullOrder, spinUrl);

    return { ok: true, isRandomSpin: true, status: "PENDING" };
  }

  // 1. Immediately send Telegram Quote Alert with Status: Processing
  await sendOrderPaidTelegramAlert(fullOrder);

  // 2. Run fulfillment with silentTelegram so it doesn't send duplicate unformatted messages
  const fulfillmentResult = await fulfillPaidOrder(fullOrder.orderNumber, {
    silentTelegram: true,
  });

  // 3. Query updated order status after fulfillment
  const updatedOrder =
    (await prisma.order.findUnique({
      where: { id: orderId },
      include: { game: true, product: true },
    })) || fullOrder;

  const redeemCode = extractRedeemCode(updatedOrder);

  // 4. Update the Telegram quote message in place if DELIVERED or FAILED
  if (updatedOrder.status === "DELIVERED") {
    await consumeOrderCouponAtomically(updatedOrder.id);
    await updateOrderDeliveryTelegramAlert(updatedOrder.orderNumber, "DELIVERED", {
      redeemCode,
      at: updatedOrder.deliveredAt || new Date(),
    });
  } else if (
    updatedOrder.status === "FAILED" ||
    fulfillmentResult?.error ||
    updatedOrder.failureReason
  ) {
    await updateOrderDeliveryTelegramAlert(updatedOrder.orderNumber, "FAILED", {
      error: fulfillmentResult?.error || updatedOrder.failureReason,
      at: new Date(),
    });
  } else if (updatedOrder.status === "PROCESSING" && updatedOrder.topupProviderRef) {
    // Auto-track upstream delivery in background if order is PROCESSING
    startBackgroundOrderTracker(updatedOrder.orderNumber);
  }

  return fulfillmentResult;
}
