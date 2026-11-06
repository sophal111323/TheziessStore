import { prisma } from "./prisma";
import {
  notifyTelegramWithResult,
  editTelegramMessage,
  escapeHtml,
} from "./telegram";
import {
  getTelegramOrderEntry,
  saveTelegramOrderEntry,
  type TelegramOrderEntry,
} from "./telegram-order-store";

/**
 * Format a Date object as HH:mm:ss in Cambodia / Indochina time (UTC+7)
 */
export function formatPhnomPenhTime(date?: Date | string | null): string {
  let d: Date;
  if (!date) {
    d = new Date();
  } else if (date instanceof Date) {
    d = isNaN(date.getTime()) ? new Date() : date;
  } else {
    d = new Date(date);
    if (isNaN(d.getTime())) d = new Date();
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Phnom_Penh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export interface FormatOrderQuoteParams {
  orderNumber: string;
  gameName: string;
  itemName: string;
  playerUid: string;
  serverId?: string | null;
  playerNickname?: string | null;
  amountUsd: number;
  paidAtTime: string;
  createdAtTime: string;
  status: "PROCESSING" | "DELIVERED" | "FAILED" | "SPIN_PENDING" | "SPIN_SPUN" | "SPIN_COMPLETED";
  statusTime?: string | null;
  redeemCode?: string | null;
  error?: string | null;
  isRandomSpin?: boolean;
  spinUrl?: string | null;
}

/**
 * Build the exact Telegram text quote format requested by the user:
 *
 * For regular orders:
 * 💰 Payment successful!
 * --------------------------------------------
 * • Order ID: #RT-GKF8X26MEU
 * • Game: Free Fire
 * • Item: Weekly lite
 * • Player ID: 7529178137
 * • Nickname: TheziesStore
 * • Price: $0.40
 * • Time: 20:33:58
 * ------------------------------------------
 * • Order Status: Processing (or ✅Success)
 * ------------------------------------------
 * • Logs:
 *  🆕 20:33:31 Order created, awaiting payment.
 *  💰 20:33:58 Payment received
 *  ⏳ 20:33:58 Order is being processing (or ✅ 20:34:10 Order deliveried✅)
 *
 * For Random Spin / Mystery Box orders:
 * 1. Initial paid:
 * • Order Status: មិនទាន់បង្វិលកង❌
 * • Link:
 *  Open spin wheel
 *
 * 2. When spun:
 * • Order Status: បានបង្វិលកង✅
 *
 * 3. When API completed / delivered:
 * • Order Status: Success ✅
 *  ⏳ 20:34:10 Order deliveried✅
 */
export function formatOrderQuoteMessage(data: FormatOrderQuoteParams): string {
  const cleanOrderNumber = data.orderNumber.toUpperCase().replace(/^#+/, "");
  const uidDisplay = data.serverId
    ? `${data.playerUid} (${data.serverId})`
    : data.playerUid;
  const nicknameDisplay = (data.playerNickname || "").trim() || "TheziesStore";
  const priceDisplay = `$${data.amountUsd.toFixed(2)}`;

  let statusText = "Processing";
  let statusLogLine = ` ⏳ ${data.statusTime || data.paidAtTime} Order is being processing`;
  let linkSection = "";

  if (data.isRandomSpin) {
    if (data.status === "SPIN_PENDING" || data.status === "PROCESSING") {
      statusText = "មិនទាន់បង្វិលកង❌";
      statusLogLine = ` ⏳ ${data.statusTime || data.paidAtTime} Order is being processing`;
      linkSection = data.spinUrl
        ? `\n• <b>Link:</b>\n <a href="${data.spinUrl}">Open spin wheel</a>`
        : "";
    } else if (data.status === "SPIN_SPUN") {
      statusText = "បានបង្វិលកង✅";
      statusLogLine = ` ⏳ ${data.statusTime || data.paidAtTime} Order is being processing`;
      linkSection = "";
    } else if (data.status === "DELIVERED" || data.status === "SPIN_COMPLETED") {
      statusText = "Success ✅";
      const time = data.statusTime || formatPhnomPenhTime(new Date());
      statusLogLine = ` ⏳ ${time} Order deliveried✅`;
      linkSection = "";
    } else if (data.status === "FAILED") {
      statusText = "Failed ❌";
      const time = data.statusTime || formatPhnomPenhTime(new Date());
      const errText = data.error ? ` (${escapeHtml(data.error)})` : "";
      statusLogLine = ` ❌ ${time} Order failed${errText}`;
      linkSection = "";
    }
  } else {
    if (data.status === "DELIVERED") {
      statusText = "✅Success";
      const time = data.statusTime || formatPhnomPenhTime(new Date());
      statusLogLine = ` ✅ ${time} Order deliveried✅`;
    } else if (data.status === "FAILED") {
      statusText = "❌Failed";
      const time = data.statusTime || formatPhnomPenhTime(new Date());
      const errText = data.error ? ` (${escapeHtml(data.error)})` : "";
      statusLogLine = ` ❌ ${time} Order failed${errText}`;
    }
  }

  const redeemLine = data.redeemCode
    ? `\n 🎟️ <b>Redeem Code:</b> <code>${escapeHtml(data.redeemCode)}</code>`
    : "";

  return (
    `<blockquote>💰 <b>Payment successful!</b>\n` +
    `--------------------------------------------\n` +
    `• <b>Order ID:</b> #${escapeHtml(cleanOrderNumber)}\n` +
    `• <b>Game:</b> ${escapeHtml(data.gameName)}\n` +
    `• <b>Item:</b> ${escapeHtml(data.itemName)}\n` +
    `• <b>Player ID:</b> ${escapeHtml(uidDisplay)}\n` +
    `• <b>Nickname:</b> ${escapeHtml(nicknameDisplay)}\n` +
    `• <b>Price:</b> ${priceDisplay}\n` +
    `• <b>Time:</b> ${data.paidAtTime}\n` +
    `--------------------------------------------\n` +
    `• <b>Order Status:</b> ${statusText}\n` +
    `-------------------------------------------\n` +
    `• <b>Logs:</b>\n` +
    ` 🆕 ${data.createdAtTime} Order created, awaiting payment.\n` +
    ` 💰 ${data.paidAtTime} Payment received\n` +
    `${statusLogLine}${redeemLine}${linkSection}</blockquote>`
  );
}

/**
 * Step 1: Send the initial Telegram notification when a standard product order is paid.
 * Status is "Processing" and message is sent as a Telegram blockquote.
 */
export async function sendOrderPaidTelegramAlert(
  order: any
): Promise<{ success: boolean; messageId?: number }> {
  if (!order || !order.orderNumber) {
    return { success: false };
  }

  const cleanOrderNumber = String(order.orderNumber).trim().toUpperCase();

  // If already notified, avoid duplicate initial send
  const existing = getTelegramOrderEntry(cleanOrderNumber);
  if (existing && existing.messageId) {
    return { success: true, messageId: existing.messageId };
  }

  const gameName = order.game?.name || "Game Top Up";
  const itemName = order.product?.name || order.randomPackage?.name || "Package";
  const playerUid = order.playerUid || "—";
  const serverId = order.serverId || null;
  const playerNickname = order.playerNickname || null;
  const amountUsd = Number(order.amountUsd) || 0;

  const createdAtTime = formatPhnomPenhTime(order.createdAt);
  const paidAtTime = formatPhnomPenhTime(order.paidAt || new Date());

  const text = formatOrderQuoteMessage({
    orderNumber: cleanOrderNumber,
    gameName,
    itemName,
    playerUid,
    serverId,
    playerNickname,
    amountUsd,
    createdAtTime,
    paidAtTime,
    status: "PROCESSING",
    statusTime: paidAtTime,
    isRandomSpin: Boolean(order.isRandomSpin),
  });

  const sendResult = await notifyTelegramWithResult(text);

  if (sendResult.success && sendResult.messageId) {
    saveTelegramOrderEntry({
      orderNumber: cleanOrderNumber,
      chatId: sendResult.chatId || "",
      messageId: sendResult.messageId,
      gameName,
      itemName,
      playerUid,
      serverId,
      playerNickname,
      amountUsd,
      createdAtTime,
      paidAtTime,
      status: "PROCESSING",
      isRandomSpin: Boolean(order.isRandomSpin),
      updatedAt: Date.now(),
    });

    return { success: true, messageId: sendResult.messageId };
  }

  return { success: sendResult.success };
}

/**
 * Step 1 (Spin): Send the initial Telegram notification when a Mystery Box / Random Spin order is paid.
 * Status is "មិនទាន់បង្វិលកង❌" with clickable spin wheel link.
 */
export async function sendSpinOrderPaidTelegramAlert(
  order: any,
  spinUrl: string
): Promise<{ success: boolean; messageId?: number }> {
  if (!order || !order.orderNumber) {
    return { success: false };
  }

  const cleanOrderNumber = String(order.orderNumber).trim().toUpperCase();

  const existing = getTelegramOrderEntry(cleanOrderNumber);
  if (existing && existing.messageId) {
    return { success: true, messageId: existing.messageId };
  }

  const gameName = order.game?.name || "Game";
  const itemName = order.randomPackage?.name || "ផ្សងសំណាង";
  const playerUid = order.playerUid || "—";
  const serverId = order.serverId || null;
  const playerNickname = order.playerNickname || null;
  const amountUsd = Number(order.amountUsd) || 0;

  const createdAtTime = formatPhnomPenhTime(order.createdAt);
  const paidAtTime = formatPhnomPenhTime(order.paidAt || new Date());

  const text = formatOrderQuoteMessage({
    orderNumber: cleanOrderNumber,
    gameName,
    itemName,
    playerUid,
    serverId,
    playerNickname,
    amountUsd,
    createdAtTime,
    paidAtTime,
    status: "SPIN_PENDING",
    isRandomSpin: true,
    spinUrl,
  });

  const replyMarkup = spinUrl
    ? {
        inline_keyboard: [
          [
            {
              text: "🎡 Open spin wheel",
              url: spinUrl,
            },
          ],
        ],
      }
    : undefined;

  const sendResult = await notifyTelegramWithResult(text, replyMarkup);

  if (sendResult.success && sendResult.messageId) {
    saveTelegramOrderEntry({
      orderNumber: cleanOrderNumber,
      chatId: sendResult.chatId || "",
      messageId: sendResult.messageId,
      gameName,
      itemName,
      playerUid,
      serverId,
      playerNickname,
      amountUsd,
      createdAtTime,
      paidAtTime,
      status: "SPIN_PENDING",
      isRandomSpin: true,
      spinUrl,
      updatedAt: Date.now(),
    });

    return { success: true, messageId: sendResult.messageId };
  }

  return { success: sendResult.success };
}

/**
 * Step 2 & 3 (Spin): Edit the existing Mystery Box Telegram message when:
 * - Spun: "• Order Status: បានបង្វិលកង✅"
 * - Completed / Delivered: "• Order Status: Success ✅" + "⏳ {time} Order deliveried✅"
 */
export async function updateSpinOrderTelegramAlert(
  orderNumber: string,
  newSpinStatus: "SPUN" | "COMPLETED" | "FAILED",
  details?: {
    error?: string | null;
    at?: Date | null;
  }
): Promise<boolean> {
  const cleanOrderNumber = String(orderNumber || "").trim().toUpperCase();
  if (!cleanOrderNumber) return false;

  let entry = getTelegramOrderEntry(cleanOrderNumber);

  let fullOrder: any = null;
  try {
    fullOrder = await prisma.order.findUnique({
      where: { orderNumber: cleanOrderNumber },
      include: { game: true, product: true, randomPackage: true },
    });
  } catch (err) {
    console.warn(`[telegram-order-notification] DB lookup error for ${cleanOrderNumber}:`, err);
  }

  const gameName = fullOrder?.game?.name || entry?.gameName || "Game";
  const itemName = fullOrder?.randomPackage?.name || fullOrder?.product?.name || entry?.itemName || "ផ្សងសំណាង";
  const playerUid = fullOrder?.playerUid || entry?.playerUid || "—";
  const serverId = fullOrder?.serverId ?? entry?.serverId ?? null;
  const playerNickname = fullOrder?.playerNickname ?? entry?.playerNickname ?? null;
  const amountUsd = fullOrder ? Number(fullOrder.amountUsd) : (entry?.amountUsd || 0);

  const createdAtTime = entry?.createdAtTime || formatPhnomPenhTime(fullOrder?.createdAt);
  const paidAtTime = entry?.paidAtTime || formatPhnomPenhTime(fullOrder?.paidAt || new Date());
  const statusTime = formatPhnomPenhTime(details?.at || fullOrder?.deliveredAt || new Date());

  const mappedStatus =
    newSpinStatus === "SPUN"
      ? "SPIN_SPUN"
      : newSpinStatus === "COMPLETED"
      ? "SPIN_COMPLETED"
      : "FAILED";

  const updatedText = formatOrderQuoteMessage({
    orderNumber: cleanOrderNumber,
    gameName,
    itemName,
    playerUid,
    serverId,
    playerNickname,
    amountUsd,
    createdAtTime,
    paidAtTime,
    status: mappedStatus,
    statusTime,
    isRandomSpin: true,
    error: details?.error || fullOrder?.failureReason || entry?.error,
  });

  const emptyMarkup = { inline_keyboard: [] };

  if (entry && entry.messageId && entry.chatId) {
    const editOk = await editTelegramMessage(entry.chatId, entry.messageId, updatedText, emptyMarkup);

    saveTelegramOrderEntry({
      ...entry,
      status: mappedStatus,
      isRandomSpin: true,
      deliveredAtTime: newSpinStatus === "COMPLETED" ? statusTime : entry.deliveredAtTime,
      failedAtTime: newSpinStatus === "FAILED" ? statusTime : entry.failedAtTime,
      error: details?.error ?? entry.error,
      updatedAt: Date.now(),
    });

    if (editOk) return true;
  }

  const fallbackResult = await notifyTelegramWithResult(updatedText);
  if (fallbackResult.success && fallbackResult.messageId) {
    saveTelegramOrderEntry({
      orderNumber: cleanOrderNumber,
      chatId: fallbackResult.chatId || "",
      messageId: fallbackResult.messageId,
      gameName,
      itemName,
      playerUid,
      serverId,
      playerNickname,
      amountUsd,
      createdAtTime,
      paidAtTime,
      status: mappedStatus,
      isRandomSpin: true,
      deliveredAtTime: newSpinStatus === "COMPLETED" ? statusTime : undefined,
      failedAtTime: newSpinStatus === "FAILED" ? statusTime : undefined,
      error: details?.error,
      updatedAt: Date.now(),
    });
    return true;
  }

  return fallbackResult.success;
}

/**
 * Step 2: Edit the existing Telegram message when the supplier API calls back or completes.
 * Updates "• Order Status: ✅Success" (or ❌Failed) and appends "✅ {time} Order deliveried✅".
 */
export async function updateOrderDeliveryTelegramAlert(
  orderNumber: string,
  newStatus: "DELIVERED" | "FAILED" | "PROCESSING",
  details?: {
    redeemCode?: string | null;
    error?: string | null;
    at?: Date | null;
  }
): Promise<boolean> {
  const cleanOrderNumber = String(orderNumber || "").trim().toUpperCase();
  if (!cleanOrderNumber) return false;

  let entry = getTelegramOrderEntry(cleanOrderNumber);

  // If this was a random spin order, route to updateSpinOrderTelegramAlert
  if (entry?.isRandomSpin) {
    return updateSpinOrderTelegramAlert(
      cleanOrderNumber,
      newStatus === "DELIVERED" ? "COMPLETED" : newStatus === "FAILED" ? "FAILED" : "SPUN",
      details
    );
  }

  // If entry is not cached or we need fresh details from DB:
  let fullOrder: any = null;
  try {
    fullOrder = await prisma.order.findUnique({
      where: { orderNumber: cleanOrderNumber },
      include: { game: true, product: true, randomPackage: true },
    });
  } catch (err) {
    console.warn(`[telegram-order-notification] DB lookup error for ${cleanOrderNumber}:`, err);
  }

  if (fullOrder?.isRandomSpin) {
    return updateSpinOrderTelegramAlert(
      cleanOrderNumber,
      newStatus === "DELIVERED" ? "COMPLETED" : newStatus === "FAILED" ? "FAILED" : "SPUN",
      details
    );
  }

  const gameName = fullOrder?.game?.name || entry?.gameName || "Game Top Up";
  const itemName = fullOrder?.product?.name || entry?.itemName || "Package";
  const playerUid = fullOrder?.playerUid || entry?.playerUid || "—";
  const serverId = fullOrder?.serverId ?? entry?.serverId ?? null;
  const playerNickname = fullOrder?.playerNickname ?? entry?.playerNickname ?? null;
  const amountUsd = fullOrder ? Number(fullOrder.amountUsd) : (entry?.amountUsd || 0);

  const createdAtTime = entry?.createdAtTime || formatPhnomPenhTime(fullOrder?.createdAt);
  const paidAtTime = entry?.paidAtTime || formatPhnomPenhTime(fullOrder?.paidAt || new Date());
  const statusTime = formatPhnomPenhTime(details?.at || fullOrder?.deliveredAt || new Date());

  const redeemCode = details?.redeemCode ?? entry?.redeemCode ?? null;
  const error = details?.error ?? fullOrder?.failureReason ?? entry?.error ?? null;

  const updatedText = formatOrderQuoteMessage({
    orderNumber: cleanOrderNumber,
    gameName,
    itemName,
    playerUid,
    serverId,
    playerNickname,
    amountUsd,
    createdAtTime,
    paidAtTime,
    status: newStatus,
    statusTime,
    redeemCode,
    error,
    isRandomSpin: false,
  });

  // Try to edit the existing message if we have chatId and messageId
  if (entry && entry.messageId && entry.chatId) {
    const editOk = await editTelegramMessage(entry.chatId, entry.messageId, updatedText);

    saveTelegramOrderEntry({
      ...entry,
      status: newStatus,
      deliveredAtTime: newStatus === "DELIVERED" ? statusTime : entry.deliveredAtTime,
      failedAtTime: newStatus === "FAILED" ? statusTime : entry.failedAtTime,
      redeemCode: redeemCode ?? entry.redeemCode,
      error: error ?? entry.error,
      updatedAt: Date.now(),
    });

    if (editOk) {
      return true;
    }
  }

  // Fallback: If no existing message was recorded or editing failed, send as new quote message
  const fallbackResult = await notifyTelegramWithResult(updatedText);
  if (fallbackResult.success && fallbackResult.messageId) {
    saveTelegramOrderEntry({
      orderNumber: cleanOrderNumber,
      chatId: fallbackResult.chatId || "",
      messageId: fallbackResult.messageId,
      gameName,
      itemName,
      playerUid,
      serverId,
      playerNickname,
      amountUsd,
      createdAtTime,
      paidAtTime,
      status: newStatus,
      deliveredAtTime: newStatus === "DELIVERED" ? statusTime : undefined,
      failedAtTime: newStatus === "FAILED" ? statusTime : undefined,
      redeemCode,
      error,
      updatedAt: Date.now(),
    });
    return true;
  }

  return fallbackResult.success;
}
