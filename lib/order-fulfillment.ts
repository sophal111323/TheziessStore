import { prisma } from "@/lib/prisma";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";
import { fulfillPaidOrder } from "@/lib/fulfillment";
import { getSupplier } from "@/lib/topup";
import { startBackgroundOrderTracker } from "@/lib/order-tracker";
import { markAffiliateOrderCompleted } from "@/lib/affiliate/store";
import { extractRedeemCode } from "@/lib/redeem";
import { consumeOrderCouponAtomically } from "@/lib/coupon";
import { generateOrderToken } from "@/lib/orderToken";
<<<<<<< HEAD
import {
  sendOrderPaidTelegramAlert,
  sendSpinOrderPaidTelegramAlert,
  updateOrderDeliveryTelegramAlert,
} from "@/lib/telegram-order-notification";
=======
>>>>>>> e4e79c9a59c44a25992e6a6c6d23d99ee403298e

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
<<<<<<< HEAD
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
=======
    let spinLink = "";
    if (baseUrl) {
      try {
        const spinToken = generateOrderToken(fullOrder.orderNumber);
        spinLink = `\n<a href="${baseUrl}/spin/${fullOrder.orderNumber}?token=${spinToken}">🎡 Open Spin Wheel</a>`;
      } catch {
        // Order-token secret missing: omit the link rather than send one that 404s.
        spinLink = "";
      }
    }

    await notifyTelegram(
      `🎁 <b>Mystery Box Payment Successful!</b>\n` +
        `<b>#${escapeHtml(fullOrder.orderNumber)}</b>\n` +
        `${escapeHtml(fullOrder.game.name)} – ${escapeHtml(fullOrder.randomPackage?.name || "Mystery Box")}\n` +
        `UID: <code>${escapeHtml(fullOrder.playerUid)}</code>\n` +
        `Amount: $${fullOrder.amountUsd.toFixed(2)}\n` +
        `Status: 🎡 <b>Ready for Lucky Spin</b>${spinLink}`
    );
>>>>>>> e4e79c9a59c44a25992e6a6c6d23d99ee403298e

    return { ok: true, isRandomSpin: true, status: "PENDING" };
  }

<<<<<<< HEAD
  // 1. Immediately send Telegram Quote Alert with Status: Processing
  await sendOrderPaidTelegramAlert(fullOrder);

  // 2. Run fulfillment with silentTelegram so it doesn't send duplicate unformatted messages
=======
  // 1. Run fulfillment with silentTelegram so it doesn't send a duplicate message
>>>>>>> e4e79c9a59c44a25992e6a6c6d23d99ee403298e
  const fulfillmentResult = await fulfillPaidOrder(fullOrder.orderNumber, {
    silentTelegram: true,
  });

<<<<<<< HEAD
  // 3. Query updated order status after fulfillment
=======
  // 2. Query updated order status after fulfillment
>>>>>>> e4e79c9a59c44a25992e6a6c6d23d99ee403298e
  const updatedOrder =
    (await prisma.order.findUnique({
      where: { id: orderId },
      include: { game: true, product: true },
    })) || fullOrder;

<<<<<<< HEAD
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
=======
  const baseUrl =
    process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
  const link = baseUrl
    ? `\n<a href="${baseUrl}/admin/orders/${updatedOrder.orderNumber}">Open in admin</a>`
    : "";

  // Buyer identity (nickname / contact / email)
  const customerLines = [
    updatedOrder.playerNickname
      ? `🎮 Nickname: ${escapeHtml(updatedOrder.playerNickname)}`
      : null,
    updatedOrder.customerEmail
      ? `📧 ${escapeHtml(updatedOrder.customerEmail)}`
      : null,
    updatedOrder.customerPhone
      ? `📱 ${escapeHtml(updatedOrder.customerPhone)}`
      : null,
  ].filter(Boolean);

  // Supplier & Topup status summary
  const supplierName =
    updatedOrder.product?.supplier || updatedOrder.topupProvider || "bay2game";
  const supplier = getSupplier(supplierName);
  const supplierDisplayName = supplier.displayName;

  let statusSection = "";
  if (updatedOrder.status === "DELIVERED") {
    await consumeOrderCouponAtomically(updatedOrder.id);
    const refText = updatedOrder.topupProviderRef
      ? ` (Ref: <code>${escapeHtml(updatedOrder.topupProviderRef)}</code>)`
      : "";
    statusSection = `✅ <b>Topup DELIVERED</b> via ${escapeHtml(supplierDisplayName)}${refText}`;
  } else if (updatedOrder.status === "PROCESSING") {
    const refText = updatedOrder.topupProviderRef
      ? `${escapeHtml(supplierDisplayName)} ref: <code>${escapeHtml(updatedOrder.topupProviderRef)}</code> (processing)`
      : `Processing via ${escapeHtml(supplierDisplayName)}`;
    statusSection = `⏳ <b>Topup PROCESSING:</b> ${refText}`;
  } else if (fulfillmentResult?.error || updatedOrder.failureReason) {
    const err =
      fulfillmentResult?.error || updatedOrder.failureReason || "Unknown error";
    statusSection = `⚠️ <b>Topup FAILED (${escapeHtml(supplierDisplayName)}) — Please process manually</b>\nError: ${escapeHtml(err)}`;
  } else {
    statusSection = `📦 <b>Status:</b> ${escapeHtml(updatedOrder.status)}`;
  }

  const redeemCode = extractRedeemCode(updatedOrder);
  const redeemLine = redeemCode
    ? `🎟️ <b>Redeem Code:</b> <code>${escapeHtml(redeemCode)}</code>\n`
    : "";

  // 3. Send ONE SINGLE unified Telegram notification
  await notifyTelegram(
    `💰 <b>Payment successful!</b>\n` +
      `<b>#${escapeHtml(updatedOrder.orderNumber)}</b>\n` +
      `${escapeHtml(updatedOrder.game.name)} – ${escapeHtml(updatedOrder.product.name)}\n` +
      `UID: <code>${escapeHtml(updatedOrder.playerUid)}</code>\n` +
      (customerLines.length > 0 ? `${customerLines.join("\n")}\n` : "") +
      `${redeemLine}` +
      `Amount: $${updatedOrder.amountUsd.toFixed(2)}\n` +
      `Method: ${escapeHtml(updatedOrder.paymentMethod || "KHQR")}\n` +
      `${statusSection}${link}`
  );

  // 4. Auto-track upstream delivery in background if order is PROCESSING
  if (updatedOrder.status === "PROCESSING" && updatedOrder.topupProviderRef) {
>>>>>>> e4e79c9a59c44a25992e6a6c6d23d99ee403298e
    startBackgroundOrderTracker(updatedOrder.orderNumber);
  }

  return fulfillmentResult;
}
