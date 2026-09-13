import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { writeAuditForAdmin } from "@/lib/audit";
import { getSupplier } from "@/lib/topup";

export const dynamic = "force-dynamic";

const adjustSchema = z.object({
  action: z.string().transform((v) => v.toUpperCase()),
  rewardAmount: z.number().int().optional(),
  rewardLabel: z.string().optional(),
  reason: z.string().optional(),
});

export const POST = withAdminAuth<{ id: string }>(async (req, ctx, admin) => {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = adjustSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action, rewardAmount, rewardLabel, reason } = parsed.data;

    const tx = await prisma.randomSpinTransaction.findUnique({
      where: { id },
      include: { order: { include: { game: true } } },
    });

    if (!tx) {
      return NextResponse.json({ error: "Spin transaction not found" }, { status: 404 });
    }

    if (action === "RETRY_DELIVERY" || action === "RETRY") {
      const supplierName = tx.winningSupplier || "bay2game";
      const supplierCode = tx.winningSupplierCode;

      if (!supplierCode) {
        return NextResponse.json(
          { error: "This slot has no supplierCode configured for automatic delivery" },
          { status: 400 }
        );
      }

      const supplier = getSupplier(supplierName);
      const topupResult = await supplier.createOrder({
        orderReference: `${tx.orderNumber}-RETRY`,
        productCode: supplierCode,
        playerId: tx.playerUid,
        serverId: tx.serverId || undefined,
      });

      if (topupResult.success) {
        const ref = topupResult.transactionId || `MANUAL-${Date.now()}`;
        await prisma.randomSpinTransaction.update({
          where: { id },
          data: {
            status: "COMPLETED",
            claimedAt: new Date(),
            fulfillmentRef: ref,
            fulfillmentStatus: "DELIVERED",
            deliveryError: null,
          },
        });

        await prisma.order.update({
          where: { id: tx.orderId },
          data: { status: "DELIVERED", deliveredAt: new Date(), topupStatus: "success" },
        });

        await writeAuditForAdmin(admin, req, {
          action: "UPDATE",
          targetType: "RandomSpinTransaction",
          targetId: id,
          details: `Retried delivery for spin ${tx.orderNumber} successfully. Ref: ${ref}`,
        });

        return NextResponse.json({ ok: true, message: "Delivery retry succeeded", ref });
      } else {
        await prisma.randomSpinTransaction.update({
          where: { id },
          data: {
            deliveryError: topupResult.error || "Retry failed",
            fulfillmentStatus: "FAILED",
          },
        });
        return NextResponse.json(
          { error: `Retry failed: ${topupResult.error || "Supplier error"}` },
          { status: 502 }
        );
      }
    }

    if (action === "MARK_COMPLETED") {
      await prisma.randomSpinTransaction.update({
        where: { id },
        data: {
          status: "COMPLETED",
          claimedAt: tx.claimedAt || new Date(),
          fulfillmentStatus: "MANUALLY_COMPLETED",
          fulfillmentRef: tx.fulfillmentRef || `ADMIN-MANUAL-${admin.id.slice(0, 6)}`,
          deliveryError: null,
        },
      });

      await prisma.order.update({
        where: { id: tx.orderId },
        data: { status: "DELIVERED", deliveredAt: new Date(), deliveryNote: "Manually completed by Admin" },
      });

      await writeAuditForAdmin(admin, req, {
        action: "UPDATE",
        targetType: "RandomSpinTransaction",
        targetId: id,
        details: `Manually marked spin ${tx.orderNumber} as completed`,
      });

      return NextResponse.json({ ok: true, message: "Spin marked as completed" });
    }

    if (action === "UPDATE_REWARD") {
      await prisma.randomSpinTransaction.update({
        where: { id },
        data: {
          winningRewardAmount: rewardAmount !== undefined ? rewardAmount : tx.winningRewardAmount,
          winningRewardLabel: rewardLabel || tx.winningRewardLabel,
        },
      });

      await writeAuditForAdmin(admin, req, {
        action: "UPDATE",
        targetType: "RandomSpinTransaction",
        targetId: id,
        details: `Adjusted reward on spin ${tx.orderNumber}`,
      });

      return NextResponse.json({ ok: true, message: "Reward details adjusted" });
    }

    if (action === "BLACKLIST_USER" || action === "BLACKLIST") {
      await prisma.blockedIdentity.upsert({
        where: {
          type_value: {
            type: "uid",
            value: tx.playerUid.toLowerCase(),
          },
        },
        create: {
          type: "uid",
          value: tx.playerUid.toLowerCase(),
          reason: reason || `Blacklisted from spin transaction #${tx.orderNumber}`,
        },
        update: {
          reason: reason || `Blacklisted from spin transaction #${tx.orderNumber}`,
        },
      });

      await writeAuditForAdmin(admin, req, {
        action: "CREATE",
        targetType: "BlockedIdentity",
        targetId: tx.playerUid,
        details: `Blacklisted player UID ${tx.playerUid} from spin audit`,
      });

      return NextResponse.json({ ok: true, message: `Player UID ${tx.playerUid} blacklisted successfully` });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: any) {
    console.error("Error adjusting spin:", err);
    return NextResponse.json({ error: "Failed to adjust spin" }, { status: 500 });
  }
});
