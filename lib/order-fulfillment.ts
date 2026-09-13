import { prisma } from "@/lib/prisma";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";
import { fulfillPaidOrder } from "@/lib/fulfillment";
import { getSupplier } from "@/lib/topup";
import { startBackgroundOrderTracker } from "@/lib/order-tracker";

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
    const spinLink = baseUrl
      ? `\n<a href="${baseUrl}/spin/${fullOrder.orderNumber}">🎡 Open Spin Wheel</a>`
      : "";

    await notifyTelegram(
      `🎁 <b>Mystery Box Payment Successful!</b>\n` +
        `<b>#${escapeHtml(fullOrder.orderNumber)}</b>\n` +
        `${escapeHtml(fullOrder.game.name)} – ${escapeHtml(fullOrder.randomPackage?.name || "Mystery Box")}\n` +
        `UID: <code>${escapeHtml(fullOrder.playerUid)}</code>\n` +
        `Amount: $${fullOrder.amountUsd.toFixed(2)}\n` +
        `Status: 🎡 <b>Ready for Lucky Spin</b>${spinLink}`
    );

    return { ok: true, isRandomSpin: true, status: "PENDING" };
  }

  // 1. Run fulfillment with silentTelegram so it doesn't send a duplicate message
  const fulfillmentResult = await fulfillPaidOrder(fullOrder.orderNumber, {
    silentTelegram: true,
  });

  // 2. Query updated order status after fulfillment
  const updatedOrder =
    (await prisma.order.findUnique({
      where: { id: orderId },
      include: { game: true, product: true },
    })) || fullOrder;

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

  // 3. Send ONE SINGLE unified Telegram notification
  await notifyTelegram(
    `💰 <b>Payment successful!</b>\n` +
      `<b>#${escapeHtml(updatedOrder.orderNumber)}</b>\n` +
      `${escapeHtml(updatedOrder.game.name)} – ${escapeHtml(updatedOrder.product.name)}\n` +
      `UID: <code>${escapeHtml(updatedOrder.playerUid)}</code>\n` +
      (customerLines.length > 0 ? `${customerLines.join("\n")}\n` : "") +
      `Amount: $${updatedOrder.amountUsd.toFixed(2)}\n` +
      `Method: ${escapeHtml(updatedOrder.paymentMethod || "KHQR")}\n` +
      `${statusSection}${link}`
  );

  // 4. Auto-track upstream delivery in background if order is PROCESSING
  if (updatedOrder.status === "PROCESSING" && updatedOrder.topupProviderRef) {
    startBackgroundOrderTracker(updatedOrder.orderNumber);
  }

  return fulfillmentResult;
}
