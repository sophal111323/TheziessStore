import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/getIp";
import { publicRateLimit } from "@/lib/apiSecurity";
import { lookupBay2GameNickname } from "@/lib/gameLookup/bay2game";

export const dynamic = "force-dynamic";

const PAID_STATES = new Set(["PAID", "PROCESSING", "DELIVERED"]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    if (!orderNumber) {
      return NextResponse.json({ error: "Order number is required" }, { status: 400 });
    }

    const limited = publicRateLimit(req, `spin_detail:${orderNumber}`, {
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        game: {
          select: {
            id: true,
            slug: true,
            name: true,
            imageUrl: true,
            currencyName: true,
            uidLabel: true,
          },
        },
        randomPackage: {
          include: {
            slots: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
        spinTransaction: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.isRandomSpin || !order.randomPackage) {
      return NextResponse.json(
        { error: "This order is not associated with a Lucky Wheel / Mystery Box package" },
        { status: 400 }
      );
    }

    const isPaid = PAID_STATES.has(order.status);
    if (!isPaid) {
      return NextResponse.json(
        {
          error: "Payment not completed",
          status: "PAYMENT_REQUIRED",
          orderStatus: order.status,
        },
        { status: 402 }
      );
    }

    // Banlist security check
    const clientIp = getClientIp(req);
    const blocked = await prisma.blockedIdentity.findFirst({
      where: {
        OR: [
          { type: "uid", value: order.playerUid.toLowerCase() },
          { type: "ip", value: clientIp.toLowerCase() },
        ],
      },
    });

    if (blocked) {
      return NextResponse.json(
        { error: "Your account is temporarily restricted. Contact support." },
        { status: 403 }
      );
    }

    // Ensure transaction row exists
    let spinTx = order.spinTransaction;
    if (!spinTx) {
      spinTx = await prisma.randomSpinTransaction.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          packageId: order.randomPackage.id,
          gameId: order.gameId,
          playerUid: order.playerUid,
          serverId: order.serverId,
          playerNickname: order.playerNickname,
          status: "PENDING",
        },
        update: {},
      });
    }

    let playerNickname = order.playerNickname || spinTx.playerNickname || null;
    if (!playerNickname && order.playerUid && order.game?.slug) {
      try {
        const lookup = await lookupBay2GameNickname(order.game.slug, order.playerUid, order.serverId || undefined);
        if (lookup?.username) {
          playerNickname = lookup.username;
          await prisma.order.update({
            where: { id: order.id },
            data: { playerNickname: lookup.username },
          }).catch(() => {});
          if (spinTx) {
            await prisma.randomSpinTransaction.update({
              where: { id: spinTx.id },
              data: { playerNickname: lookup.username },
            }).catch(() => {});
          }
        }
      } catch {
        // ignore lookup errors
      }
    }

    // Query products for this game to auto-resolve icons if slot icon is not an image URL
    const gameProducts = await prisma.product.findMany({
      where: { gameId: order.gameId, active: true },
      select: { name: true, supplierCode: true, imageUrl: true },
    });

    // Sanitize slots for client (do not leak backend supplier codes)
    const sanitizedSlots = order.randomPackage.slots.map((s, index) => {
      let icon = s.icon;
      const isUrl = icon && (icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("/"));
      if (!isUrl) {
        // Attempt match by supplierCode or name against game products
        const matchedProduct = gameProducts.find((p) => {
          if (s.supplierCode && p.supplierCode && s.supplierCode.trim().toLowerCase() === p.supplierCode.trim().toLowerCase()) {
            return true;
          }
          const sLabel = s.label.trim().toLowerCase();
          const pName = p.name.trim().toLowerCase();
          return sLabel === pName || pName.includes(sLabel) || sLabel.includes(pName);
        });

        if (matchedProduct?.imageUrl) {
          icon = matchedProduct.imageUrl;
        } else if (order.randomPackage?.imageUrl) {
          icon = order.randomPackage.imageUrl;
        } else if (order.game?.imageUrl) {
          icon = order.game.imageUrl;
        }
      }

      return {
        id: s.id,
        index,
        label: s.label,
        rewardType: s.rewardType,
        rewardAmount: s.rewardAmount,
        probability: s.probability,
        color: s.color,
        textColor: s.textColor,
        icon,
      };
    });

    return NextResponse.json({
      orderNumber: order.orderNumber,
      status: spinTx.status, // "PENDING" | "SPUN" | "COMPLETED" | "FAILED"
      playerUid: order.playerUid,
      serverId: order.serverId,
      playerNickname: playerNickname,
      game: order.game,
      package: {
        id: order.randomPackage.id,
        name: order.randomPackage.name,
        badge: order.randomPackage.badge,
        imageUrl: order.randomPackage.imageUrl,
        description: order.randomPackage.description,
      },
      slots: sanitizedSlots,
      winningSlotId: spinTx.winningSlotId,
      winningRewardAmount: spinTx.winningRewardAmount,
      winningRewardLabel: spinTx.winningRewardLabel,
      spunAt: spinTx.spunAt,
      claimedAt: spinTx.claimedAt,
      fulfillmentRef: spinTx.fulfillmentRef,
      fulfillmentStatus: spinTx.fulfillmentStatus,
      deliveryError: spinTx.deliveryError,
    });
  } catch (err: any) {
    console.error("Error fetching spin details:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

