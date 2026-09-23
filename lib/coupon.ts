import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface ValidateCouponParams {
  code: string;
  orderAmountUsd: number;
  playerUid?: string | null;
  gameId?: string | null;
}

export interface ValidateCouponResult {
  valid: boolean;
  error?: string;
  code?: string;
  promoCodeId?: string;
  discountType?: string;
  discountValue?: number;
  discountUsd?: number;
  finalAmountUsd?: number;
  onePerUser?: boolean;
}

/**
 * Validates a promo code without consuming it.
 * Checks code existence, active status, expiration date, max uses limit,
 * minimum order requirement, and per-user/game ID usage limit.
 */
export async function validatePromoCode(
  params: ValidateCouponParams
): Promise<ValidateCouponResult> {
  const { code, orderAmountUsd, playerUid } = params;

  if (!code || !code.trim()) {
    return { valid: false, error: "Coupon code is invalid or expired." };
  }

  const normalizedCode = code.toUpperCase().trim();
  const normalizedUid = playerUid ? playerUid.trim().toLowerCase() : null;

  const promo = await prisma.promoCode.findUnique({
    where: { code: normalizedCode },
  });

  if (!promo || !promo.active) {
    return { valid: false, error: "Coupon code is invalid or expired." };
  }

  // Check expiration
  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return { valid: false, error: "Coupon code is invalid or expired." };
  }

  // Check global usage limit
  if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
    return { valid: false, error: "This coupon has reached its usage limit." };
  }

  // Check minimum order amount
  if (orderAmountUsd < promo.minOrderUsd) {
    return {
      valid: false,
      error: `Minimum order of $${promo.minOrderUsd.toFixed(2)} required`,
    };
  }

  // Check per-user / game ID usage limit
  if (normalizedUid && (promo.onePerUser || promo.maxUsesPerUser > 0)) {
    const maxAllowed = promo.maxUsesPerUser > 0 ? promo.maxUsesPerUser : 1;
    const completedUses = await prisma.couponUsage.count({
      where: {
        promoCodeId: promo.id,
        userIdentifier: normalizedUid,
        status: "USED",
      },
    });

    if (completedUses >= maxAllowed) {
      return { valid: false, error: "You have already used this coupon." };
    }
  }

  // Calculate discount safely
  let discountUsd =
    promo.discountType === "PERCENT"
      ? (orderAmountUsd * promo.discountValue) / 100
      : promo.discountValue;

  discountUsd = Math.min(discountUsd, orderAmountUsd);
  discountUsd = Math.round(discountUsd * 100) / 100;
  const finalAmountUsd = Math.round((orderAmountUsd - discountUsd) * 100) / 100;

  return {
    valid: true,
    code: promo.code,
    promoCodeId: promo.id,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    discountUsd,
    finalAmountUsd,
    onePerUser: promo.onePerUser,
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

