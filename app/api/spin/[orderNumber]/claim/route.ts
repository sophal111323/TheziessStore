import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSupplier } from "@/lib/topup";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";
import { publicRateLimit } from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    if (!orderNumber) {
      return NextResponse.json({ error: "Order number is required" }, { status: 400 });
    }

    const limited = publicRateLimit(req, `claim:${orderNumber}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const tx = await prisma.randomSpinTransaction.findUnique({
      where: { orderNumber },
      include: {
        order: {
          include: {
            game: true,
          },
        },
        package: true,
      },
    });

    if (!tx) {
      return NextResponse.json({ error: "Spin transaction not found" }, { status: 404 });
    }

    // 1. Prevent double-claiming rewards
    if (tx.status === "COMPLETED") {
      return NextResponse.json({
        ok: true,
        alreadyClaimed: true,
        message: "Reward has already been claimed",
        rewardLabel: tx.winningRewardLabel,
        rewardAmount: tx.winningRewardAmount,
        claimedAt: tx.claimedAt,
      });
    }

    if (tx.status !== "SPUN") {
      return NextResponse.json(
        { error: "Please spin the wheel before claiming your reward" },
        { status: 400 }
      );
    }

    // Atomic lock: Only one concurrent request can transition SPUN -> CLAIMING
    const locked = await prisma.randomSpinTransaction.updateMany({
      where: { id: tx.id, status: "SPUN" },
      data: { status: "CLAIMING" },
    });

    if (locked.count !== 1) {
      return NextResponse.json(
        { error: "Reward is already being processed or has been claimed" },
        { status: 409 }
      );
    }

    if (!tx.winningSlotId || tx.winningRewardAmount === null) {
      await prisma.randomSpinTransaction.update({
        where: { id: tx.id },
        data: { status: "SPUN" },
      });
      return NextResponse.json(
        { error: "No winning reward recorded for this spin" },
        { status: 400 }
      );
    }

    const order = tx.order;
    const supplierName = tx.winningSupplier || "bay2game";
    const productCode = tx.winningSupplierCode;

    let fulfillmentRef = `SPIN-${order.orderNumber}`;
    let fulfillmentStatus = "COMPLETED";
    let deliveryNote = `Lucky Spin Won: ${tx.winningRewardLabel}`;

    // 2. Deliver reward via upstream supplier API if supplierCode is configured
    if (productCode && supplierName !== "manual") {
      try {
        const supplier = getSupplier(supplierName);
        const topupResult = await supplier.createOrder({
          orderReference: `${order.orderNumber}-SPIN`,
          productCode,
          playerId: order.playerUid,
          serverId: order.serverId || undefined,
        });

        if (topupResult.success) {
          fulfillmentRef = topupResult.transactionId || fulfillmentRef;
          deliveryNote += ` (Delivered via ${supplier.displayName} Ref: ${fulfillmentRef})`;
        } else {
          console.warn(`Upstream topup error for spin ${order.orderNumber}:`, topupResult.error);
          fulfillmentStatus = "PENDING_DELIVERY";
          deliveryNote += ` (Upstream ${supplier.displayName} pending: ${topupResult.error || "Unknown error"})`;
        }
      } catch (err: any) {
        console.error("Upstream supplier exception during claim:", err);
        fulfillmentStatus = "PENDING_DELIVERY";
        deliveryNote += ` (Supplier error: ${err?.message || "Connection failed"})`;
      }
    } else if (supplierName === "manual") {
      fulfillmentStatus = "MANUAL_DELIVERY_REQUIRED";
      deliveryNote += ` (Manual dispatch required by Admin)`;
    }

    // 3. Update RandomSpinTransaction to COMPLETED
    const claimedAt = new Date();
    await prisma.randomSpinTransaction.update({
      where: { id: tx.id },
      data: {
        status: "COMPLETED",
        claimedAt,
        fulfillmentRef,
        fulfillmentStatus,
        deliveryError: null,
      },
    });

    // 4. Update parent Order to DELIVERED
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "DELIVERED",
        deliveredAt: claimedAt,
        deliveryNote,
        topupProviderRef: fulfillmentRef,
        topupStatus: "success",
      },
    });

    // 5. Telegram notification
    const baseUrl = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
    const adminLink = baseUrl ? `\n<a href="${baseUrl}/admin/lucky-wheel">View in Admin</a>` : "";

    await notifyTelegram(
      `🎉 <b>Lucky Spin Reward Claimed!</b>\n` +
        `<b>#${escapeHtml(order.orderNumber)}</b>\n` +
        `Game: ${escapeHtml(order.game.name)}\n` +
        `Package: ${escapeHtml(tx.package.name)}\n` +
        `UID: <code>${escapeHtml(order.playerUid)}</code>\n` +
        `Won: <b>${escapeHtml(tx.winningRewardLabel || "Diamond Reward")}</b>\n` +
        `Status: ✅ <b>COMPLETED</b>\n` +
        `Ref: <code>${escapeHtml(fulfillmentRef)}</code>${adminLink}`
    );

    return NextResponse.json({
      ok: true,
      status: "COMPLETED",
      rewardLabel: tx.winningRewardLabel,
      rewardAmount: tx.winningRewardAmount,
      claimedAt,
      fulfillmentRef,
    });
  } catch (err: any) {
    console.error("Error claiming spin reward:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

