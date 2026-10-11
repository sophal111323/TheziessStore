export const dynamic = "force-dynamic";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { GiftClaim } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getIp";
import { applyRateLimit } from "@/lib/rateLimit";
import { getOrCreateGiftBoxSlots, pickWeightedGiftSlot } from "@/lib/giftBox";
import { verifyOrderToken } from "@/lib/orderToken";
import { logSecurityEvent } from "@/lib/secureLogger";
import { logError } from "@/lib/errorLogger";

const PAID_STATES = new Set(["PAID", "PROCESSING", "DELIVERED"]);

function isPrismaUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/** Response for an order whose gift was already opened (built from the DB row only). */
function alreadyClaimedResponse(claim: GiftClaim) {
  return NextResponse.json({
    ok: true,
    alreadyClaimed: true,
    message: "ការកុម្ម៉ង់នេះបានបើកកាដូរួចរាល់ហើយ",
    claim: {
      slotNumber: claim.slotNumber,
      rewardType: claim.rewardType,
      rewardTitle: claim.rewardTitle,
      rewardValue: claim.rewardValue,
      rewardAmount: claim.rewardAmount,
      promoCodeStr: claim.promoCodeStr,
      claimedAt: claim.claimedAt,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const ip = getClientIp(req);

  try {
    const { orderNumber } = await params;
    if (!orderNumber) {
      return NextResponse.json({ error: "Order number required" }, { status: 400 });
    }

    const cleanOrderNumber = orderNumber.toUpperCase().trim();

    // ── Token validation (FIND-001 fix) ──────────────────────────────────
    const token = req.nextUrl.searchParams.get("token");
    const isTokenValid = verifyOrderToken(cleanOrderNumber, token);
    
    if (!isTokenValid) {
      logSecurityEvent({
        event: "gift_open_unauthorized",
        detail: `Attempted gift open without valid token: ${cleanOrderNumber}`,
        ip,
      });
      return NextResponse.json({ error: "រកមិនឃើញការកុម្ម៉ង់នេះទេ (Order not found)" }, { status: 404 });
    }

    // Rate limit opening attempts per IP
    const rl = await applyRateLimit(`gift-open:${ip}:${cleanOrderNumber}`, 10, 60 * 1000, ip);
    if (rl) {
      return NextResponse.json(
        { error: "អ្នកបានចុចញឹកញាប់ពេក សូមរង់ចាំបន្តិច" },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const chosenSlotNumber = Number(body?.slotNumber) || 1;

    if (chosenSlotNumber < 1 || chosenSlotNumber > 9) {
      return NextResponse.json({ error: "លេខកាដូត្រូវតែនៅចន្លោះពី 1 ដល់ 9" }, { status: 400 });
    }

    // Check system settings
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (settings?.giftEventEnabled === false) {
      return NextResponse.json(
        { error: "កម្មវិធីបើកកាដូត្រូវបានបិទបណ្តោះអាសន្នដោយ Admin" },
        { status: 403 }
      );
    }

    // Fetch order
    const order = await prisma.order.findUnique({
      where: { orderNumber: cleanOrderNumber },
      include: {
        game: { select: { id: true, name: true, slug: true } },
        product: { select: { id: true, name: true } },
        giftClaim: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "រកមិនឃើញការកុម្ម៉ង់នេះទេ (Order not found)" }, { status: 404 });
    }

    // 1. Verify payment status
    if (!PAID_STATES.has(order.status)) {
      return NextResponse.json(
        { error: "ទាល់តែទូទាត់ប្រាក់ជោគជ័យ (Paid) ទើបមានសិទ្ធិបើកកាដូបាន" },
        { status: 402 }
      );
    }

    // 2. Check if already claimed
    if (order.giftClaim) {
      return alreadyClaimedResponse(order.giftClaim);
    }

    // 3. Load slots pool
    const allSlots = await getOrCreateGiftBoxSlots();
    const winningSlot = pickWeightedGiftSlot(allSlots);

    // Resolve prize details
    let promoCodeStr: string | null = null;
    let rewardValue = winningSlot.rewardValue || null;

    if (winningSlot.rewardType === "PROMO_CODE") {
      if (winningSlot.promoCode?.code) {
        promoCodeStr = winningSlot.promoCode.code;
      } else if (winningSlot.rewardValue) {
        promoCodeStr = winningSlot.rewardValue.toUpperCase().trim();
      } else {
        promoCodeStr = `GIFT${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      }
      rewardValue = promoCodeStr;
    } else if (winningSlot.rewardType === "GAME_PACKAGE") {
      rewardValue = winningSlot.product?.name || winningSlot.rewardValue || "Game Package";
    } else if (winningSlot.rewardType === "THANK_YOU") {
      rewardValue = "THANK_YOU";
    }

    // 4. ATOMIC DATABASE TRANSACTION (Guarantees zero double claims)
    // A request that loses the race gets the persisted claim back with
    // created=false and must answer from it, never from its own local pick.
    let result: { claim: GiftClaim; created: boolean };
    try {
      result = await prisma.$transaction(async (tx) => {
        // Re-check inside transaction
        const existing = await tx.giftClaim.findUnique({
          where: { orderId: order.id },
        });
        if (existing) {
          return { claim: existing, created: false };
        }

        const created = await tx.giftClaim.create({
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          playerUid: order.playerUid,
          slotNumber: chosenSlotNumber,
          rewardType: winningSlot.rewardType,
          rewardTitle: winningSlot.label,
          rewardValue: rewardValue,
          rewardAmount: winningSlot.rewardType === "THANK_YOU" ? 0 : winningSlot.rewardAmount,
          promoCodeStr: promoCodeStr,
          productId: winningSlot.productId || null,
          supplier: winningSlot.rewardType === "THANK_YOU" ? "none" : (winningSlot.supplier || "bay2game"),
          supplierCode: winningSlot.rewardType === "THANK_YOU" ? null : (winningSlot.supplierCode || null),
          status: winningSlot.rewardType === "THANK_YOU" ? "DELIVERED" : "CLAIMED",
          clientIp: ip,
        },
        });
        return { claim: created, created: true };
      }, { timeout: 15000, maxWait: 10000 });
    } catch (txErr) {
      // Concurrent create hit the unique orderId/orderNumber: re-read the winner.
      if (!isPrismaUniqueError(txErr)) throw txErr;
      const winner = await prisma.giftClaim.findUnique({ where: { orderId: order.id } });
      if (!winner) throw txErr;
      result = { claim: winner, created: false };
    }

    if (!result.created) {
      return alreadyClaimedResponse(result.claim);
    }

    // Every reward field below comes from the persisted claim.
    const claim = result.claim;

    // Generate reveal map for other boxes so the player sees what was in the remaining boxes
    const revealedBoxes = allSlots.map((s, idx) => {
      const boxNum = idx + 1;
      if (boxNum === chosenSlotNumber) {
        return {
          slotNumber: boxNum,
          isWinner: true,
          label: claim.rewardTitle,
          icon: winningSlot.icon || "🎁",
          color: winningSlot.color,
          rewardType: claim.rewardType,
        };
      }
      return {
        slotNumber: boxNum,
        isWinner: false,
        label: s.label,
        icon: s.icon || "🎁",
        color: s.color,
        rewardType: s.rewardType,
      };
    });

    return NextResponse.json({
      ok: true,
      success: true,
      chosenSlotNumber,
      winningSlot: {
        slotNumber: claim.slotNumber,
        label: claim.rewardTitle,
        rewardType: claim.rewardType,
        rewardTitle: claim.rewardTitle,
        rewardValue: claim.rewardValue,
        rewardAmount: claim.rewardAmount,
        promoCodeStr: claim.promoCodeStr,
        icon: winningSlot.icon || "🎁",
        color: winningSlot.color,
      },
      revealedBoxes,
      claim: {
        id: claim.id,
        slotNumber: claim.slotNumber,
        rewardType: claim.rewardType,
        rewardTitle: claim.rewardTitle,
        rewardValue: claim.rewardValue,
        rewardAmount: claim.rewardAmount,
        diamondAmount: claim.rewardType === "DIAMOND" ? claim.rewardAmount : null,
        promoCode: claim.promoCodeStr,
        promoCodeStr: claim.promoCodeStr,
        supplier: claim.supplier,
        supplierCode: claim.supplierCode,
        claimedAt: claim.claimedAt,
      },
    });
  } catch (err: unknown) {
    logError("Gift opening error", err);
    return NextResponse.json(
      { error: "មានបញ្ហាបច្ចេកទេសក្នុងការបើកកាដូ" },
      { status: 500 }
    );
  }
}
