export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateGiftBoxSlots } from "@/lib/giftBox";

const PAID_STATES = new Set(["PAID", "PROCESSING", "DELIVERED"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    if (!orderNumber) {
      return NextResponse.json({ error: "Order number required" }, { status: 400 });
    }

    const cleanOrderNumber = orderNumber.toUpperCase().trim();

    // Check system settings
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const eventEnabled = settings?.giftEventEnabled !== false;

    // Fetch order with gift claim
    const order = await prisma.order.findUnique({
      where: { orderNumber: cleanOrderNumber },
      include: {
        game: { select: { id: true, name: true, slug: true, imageUrl: true } },
        product: { select: { id: true, name: true, amount: true } },
        giftClaim: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "រកមិនឃើញការកុម្ម៉ង់នេះទេ (Order not found)" }, { status: 404 });
    }

    const isPaid = PAID_STATES.has(order.status);
    const slots = await getOrCreateGiftBoxSlots();

    // Return sanitized slots for the client
    const sanitizedSlots = slots.map((s) => ({
      slotNumber: s.slotNumber,
      label: s.label,
      color: s.color,
      icon: s.icon || "🎁",
      active: s.active,
    }));

    return NextResponse.json({
      eventEnabled,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      isPaid,
      playerUid: order.playerUid,
      gameName: order.game?.name || "Game",
      gameSlug: order.game?.slug || "",
      productName: order.product?.name || "",
      amountUsd: order.amountUsd,
      order: {
        orderNumber: order.orderNumber,
        gameName: order.game?.name || "Game",
        gameSlug: order.game?.slug || "",
        productName: order.product?.name || "",
        playerUid: order.playerUid,
        serverId: order.serverId,
        playerNickname: order.playerNickname,
        status: order.status,
        isPaid,
        amountUsd: order.amountUsd,
      },
      alreadyClaimed: Boolean(order.giftClaim),
      claim: order.giftClaim
        ? {
            slotNumber: order.giftClaim.slotNumber,
            rewardType: order.giftClaim.rewardType,
            rewardTitle: order.giftClaim.rewardTitle,
            rewardValue: order.giftClaim.rewardValue,
            rewardAmount: order.giftClaim.rewardAmount,
            promoCodeStr: order.giftClaim.promoCodeStr,
            claimedAt: order.giftClaim.claimedAt,
          }
        : null,
      boxes: sanitizedSlots,
      slots: sanitizedSlots,
    });
  } catch (err) {
    console.error("Gift box info error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
