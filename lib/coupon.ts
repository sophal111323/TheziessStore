import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface ValidateCouponParams {
  code: string;
  orderAmountUsd?: number | null;
  playerUid?: string | null;
  gameId?: string | null;
  productId?: string | null;
  claimNow?: boolean;
}

export interface ValidateCouponResult {
  valid: boolean;
  claimed?: boolean;
  error?: string;
  code?: string;
  promoCodeId?: string;
  discountType?: string;
  discountValue?: number;
  discountUsd?: number;
  finalAmountUsd?: number;
  onePerUser?: boolean;
  gameId?: string | null;
  allowedPackageIds?: string[];
  usageId?: string;
}

/**
 * Validates a promo code.
 * If claimNow is true, atomically records usage and increments usedCount right away (claim on apply).
 * Checks code existence, active status, expiration date, max uses limit,
 * minimum order requirement, game restriction, package restriction, and per-user/game ID usage limit.
 */
export async function validatePromoCode(
  params: ValidateCouponParams
): Promise<ValidateCouponResult> {
  const { code, orderAmountUsd, playerUid, gameId, productId, claimNow } = params;

  if (!code || !code.trim()) {
    return { valid: false, error: "សូមបញ្ចូលកូដបញ្ចុះតម្លៃ" };
  }

  const normalizedCode = code.toUpperCase().trim();
  const normalizedUid = playerUid ? playerUid.trim().toLowerCase() : null;

  const promo = await prisma.promoCode.findUnique({
    where: { code: normalizedCode },
    include: { game: { select: { id: true, name: true, slug: true } } },
  });

  if (!promo || !promo.active) {
    return { valid: false, error: "កូដបញ្ចុះតម្លៃមិនត្រឹមត្រូវ ឬត្រូវបានបិទ" };
  }

  // Check expiration
  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return { valid: false, error: "កូដបញ្ចុះតម្លៃនេះបានផុតកំណត់ហើយ" };
  }

  // Check global usage limit
  if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
    return { valid: false, error: "កូដនេះត្រូវបានអ្នកផ្សេង Claim អស់ហើយ (ត្រូវបានប្រើប្រាស់អស់កំណត់)" };
  }

  // Check game restriction
  if (promo.gameId && gameId && promo.gameId !== gameId) {
    return {
      valid: false,
      error: `កូដនេះអាចប្រើបានតែសម្រាប់ហ្គេម "${promo.game?.name || "ជាក់លាក់"}" ប៉ុណ្ណោះ`,
    };
  }

  // Parse allowed package IDs
  let allowedPackageIds: string[] = [];
  try {
    allowedPackageIds = JSON.parse(promo.allowedPackageIds || "[]");
  } catch {
    allowedPackageIds = [];
  }

  // Check package restriction if a productId is passed
  if (productId && allowedPackageIds.length > 0 && !allowedPackageIds.includes(productId)) {
    return {
      valid: false,
      error: "កូដនេះមិនអាចប្រើសម្រាប់កញ្ចប់ដែលបានជ្រើសរើសនេះទេ",
      allowedPackageIds,
    };
  }

  const basePrice = typeof orderAmountUsd === "number" && orderAmountUsd > 0 ? orderAmountUsd : 0;

  // Check minimum order amount if price is known
  if (basePrice > 0 && promo.minOrderUsd > 0 && basePrice < promo.minOrderUsd) {
    return {
      valid: false,
      error: `ទាមទារការកុម្ម៉ង់យ៉ាងតិច $${promo.minOrderUsd.toFixed(2)}`,
      allowedPackageIds,
    };
  }

  // Calculate discount safely
  let discountUsd = 0;
  let finalAmountUsd = basePrice;
  if (basePrice > 0) {
    discountUsd =
      promo.discountType === "PERCENT"
        ? (basePrice * promo.discountValue) / 100
        : promo.discountValue;

    discountUsd = Math.min(discountUsd, basePrice);
    discountUsd = Math.round(discountUsd * 100) / 100;
    finalAmountUsd = Math.round((basePrice - discountUsd) * 100) / 100;
  }

  // Check per-user / game ID usage limit
  if (normalizedUid && (promo.onePerUser || promo.maxUsesPerUser > 0)) {
    const maxAllowed = promo.maxUsesPerUser > 0 ? promo.maxUsesPerUser : 1;

    // If order creation is checking an already-claimed coupon (!claimNow), see if unlinked claim exists
    if (!claimNow) {
      const unlinkedClaim = await prisma.couponUsage.findFirst({
        where: {
          promoCodeId: promo.id,
          userIdentifier: normalizedUid,
          status: "USED",
          orderId: null,
        },
        orderBy: { createdAt: "desc" },
      });

      if (unlinkedClaim) {
        // User already claimed this code on Apply, so allow attaching it to the order
        return {
          valid: true,
          claimed: true,
          code: promo.code,
          promoCodeId: promo.id,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
          discountUsd,
          finalAmountUsd,
          onePerUser: promo.onePerUser,
          gameId: promo.gameId,
          allowedPackageIds,
          usageId: unlinkedClaim.id,
        };
      }
    }

    const completedUses = await prisma.couponUsage.count({
      where: {
        promoCodeId: promo.id,
        userIdentifier: normalizedUid,
        status: "USED",
      },
    });

    if (completedUses >= maxAllowed) {
      return { valid: false, error: "អ្នក (Player ID នេះ) បាន Claim ឬប្រើប្រាស់កូដនេះរួចហើយ" };
    }
  }

  // 🎟️ CLAIM ON APPLY: If claimNow is true and player ID is verified/provided
  let createdUsageId: string | undefined;
  if (claimNow && normalizedUid) {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Double check per-user limit inside transaction to prevent race conditions
        if (normalizedUid && (promo.onePerUser || promo.maxUsesPerUser > 0)) {
          const maxAllowed = promo.maxUsesPerUser > 0 ? promo.maxUsesPerUser : 1;
          const userUses = await tx.couponUsage.count({
            where: {
              promoCodeId: promo.id,
              userIdentifier: normalizedUid,
              status: "USED",
            },
          });
          if (userUses >= maxAllowed) {
            throw new Error("អ្នក (Player ID នេះ) បាន Claim ឬប្រើប្រាស់កូដនេះរួចហើយ");
          }
        }

        // 2. Atomic increment of usedCount if maxUses permits (PostgreSQL row-level lock)
        const updateRes = await tx.promoCode.updateMany({
          where: {
            id: promo.id,
            active: true,
            ...(promo.maxUses > 0 ? { usedCount: { lt: promo.maxUses } } : {}),
          },
          data: { usedCount: { increment: 1 } },
        });

        if (updateRes.count === 0 && promo.maxUses > 0) {
          throw new Error("កូដនេះត្រូវបានអ្នកផ្សេង Claim អស់ហើយ (ត្រូវបានប្រើប្រាស់អស់កំណត់)");
        }

        const usage = await tx.couponUsage.create({
          data: {
            promoCodeId: promo.id,
            userIdentifier: normalizedUid,
            status: "USED",
            usedAt: new Date(),
            discountUsd: discountUsd || 0,
          },
        });
        createdUsageId = usage.id;
      });
    } catch (err: any) {
      return { valid: false, error: err.message || "មិនអាច Claim កូដនេះបានទេ" };
    }
  }

  return {
    valid: true,
    claimed: Boolean(claimNow && normalizedUid),
    code: promo.code,
    promoCodeId: promo.id,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    discountUsd,
    finalAmountUsd,
    onePerUser: promo.onePerUser,
    gameId: promo.gameId,
    allowedPackageIds,
    usageId: createdUsageId,
  };
}

/**
 * Records a PENDING coupon usage record linked to the newly created order.
 * CRITICAL: This DOES NOT increment usedCount or consume the coupon.
 */
export async function recordPendingCouponUsage(
  tx: Prisma.TransactionClient,
  params: {
    promoCodeId: string;
    orderId: string;
    playerUid: string;
    discountUsd: number;
  }
) {
  const normalizedUid = params.playerUid.trim().toLowerCase();

  return tx.couponUsage.upsert({
    where: { orderId: params.orderId },
    create: {
      promoCodeId: params.promoCodeId,
      orderId: params.orderId,
      userIdentifier: normalizedUid,
      status: "PENDING",
      discountUsd: params.discountUsd,
    },
    update: {
      promoCodeId: params.promoCodeId,
      userIdentifier: normalizedUid,
      status: "PENDING",
      discountUsd: params.discountUsd,
    },
  });
}

export interface ConsumeCouponResult {
  consumed: boolean;
  alreadyConsumed?: boolean;
  error?: string;
  usageId?: string;
}

/**
 * Atomically consumes a coupon ONLY after the related order/top-up is confirmed successful.
 *
 * Guarantees:
 * 1. Idempotency: Multiple calls for the same order (e.g. webhook retries) will only consume the coupon once.
 * 2. Concurrency Safety: Atomic conditional update prevents race conditions when maxUses is almost full.
 * 3. User Guard: Ensures the same Game ID has not already consumed a one-per-user coupon in another concurrent order.
 */
export async function consumeOrderCouponAtomically(
  orderId: string
): Promise<ConsumeCouponResult> {
  return prisma.$transaction(async (tx) => {
    // 1. Find coupon usage for this order
    const usage = await tx.couponUsage.findUnique({
      where: { orderId },
      include: { promoCode: true },
    });

    // If order has no coupon usage attached, nothing to consume
    if (!usage) {
      return { consumed: false, error: "no_coupon_attached" };
    }

    // Idempotency: if already marked USED, return success immediately
    if (usage.status === "USED") {
      return { consumed: true, alreadyConsumed: true, usageId: usage.id };
    }

    const promo = usage.promoCode;
    if (!promo) {
      return { consumed: false, error: "promo_code_missing" };
    }

    // 2. Check per-user limit at consumption time
    if (promo.onePerUser || promo.maxUsesPerUser > 0) {
      const maxAllowed = promo.maxUsesPerUser > 0 ? promo.maxUsesPerUser : 1;
      const alreadyUsedCount = await tx.couponUsage.count({
        where: {
          promoCodeId: promo.id,
          userIdentifier: usage.userIdentifier,
          status: "USED",
          id: { not: usage.id },
        },
      });

      if (alreadyUsedCount >= maxAllowed) {
        await tx.couponUsage.update({
          where: { id: usage.id },
          data: { status: "FAILED" },
        });
        return { consumed: false, error: "user_limit_exceeded" };
      }
    }

    // 3. Atomic conditional update on PromoCode:
    // Only increments if usedCount < maxUses (or maxUses == 0 for unlimited)
    const updateResult = await tx.promoCode.updateMany({
      where: {
        id: promo.id,
        active: true,
        OR: [
          { maxUses: { equals: 0 } },
          { usedCount: { lt: promo.maxUses } },
        ],
      },
      data: {
        usedCount: { increment: 1 },
      },
    });

    if (updateResult.count === 0) {
      // Race condition: another order grabbed the last usage slot
      await tx.couponUsage.update({
        where: { id: usage.id },
        data: { status: "FAILED" },
      });
      return { consumed: false, error: "max_uses_reached" };
    }

    // 4. Mark usage as permanently USED with timestamp
    await tx.couponUsage.update({
      where: { id: usage.id },
      data: {
        status: "USED",
        usedAt: new Date(),
      },
    });

    return { consumed: true, alreadyConsumed: false, usageId: usage.id };
  });
}

/**
 * Releases or cancels a pending coupon usage if payment fails or order is cancelled.
 * Leaves usedCount untouched so the coupon can be used again.
 */
export async function releaseOrCancelCouponUsage(
  orderId: string,
  newStatus: "CANCELLED" | "FAILED" = "CANCELLED"
) {
  try {
    const usage = await prisma.couponUsage.findUnique({
      where: { orderId },
    });

    // If it was already consumed as USED, do not rollback without manual refund audit
    if (!usage || usage.status === "USED") {
      return;
    }

    await prisma.couponUsage.update({
      where: { id: usage.id },
      data: { status: newStatus },
    });
  } catch (err) {
    console.error(`Failed to cancel coupon usage for order ${orderId}:`, err);
  }
}

