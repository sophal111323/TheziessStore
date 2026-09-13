import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/getIp";
import crypto from "crypto";
import { publicRateLimit } from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";

const PAID_STATES = new Set(["PAID", "PROCESSING", "DELIVERED"]);

/**
 * Cryptographic weighted random selection:
 * Sums all slot probabilities, chooses a random point in [0, totalWeight),
 * and returns the winning slot.
 */
function pickWeightedSlot<T extends { probability: number }>(slots: T[]): T {
  const validSlots = slots.filter((s) => s.probability > 0);
  if (validSlots.length === 0) {
    return slots[0];
  }

  const totalWeight = validSlots.reduce((sum, s) => sum + s.probability, 0);
  // Cryptographically secure integer strictly > 0
  const randomFactor = crypto.randomInt(1, 10_000_001) / 10_000_000;
  const threshold = randomFactor * totalWeight;

  let cumulative = 0;
  for (const slot of validSlots) {
    cumulative += slot.probability;
    if (threshold <= cumulative) {
      return slot;
    }
  }

  return validSlots[validSlots.length - 1];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    if (!orderNumber) {
      return NextResponse.json({ error: "Order number is required" }, { status: 400 });
    }

    // Rate limit spin attempts per IP
    const limited = publicRateLimit(req, `spin:${orderNumber}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const clientIp = getClientIp(req);

    // Fetch order with package and slots
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
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
        { error: "Order is not associated with a Mystery Box package" },
        { status: 400 }
      );
    }

    // 1. Verify user has completed payment before allowing spin
    if (!PAID_STATES.has(order.status)) {
      return NextResponse.json(
        { error: "Payment must be completed before spinning the wheel" },
        { status: 402 }
      );
    }

    // 2. Validate user is not blacklisted
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
        { error: "Your account is restricted. Contact support." },
        { status: 403 }
      );
    }

    const slots = order.randomPackage.slots;
    if (!slots || slots.length < 2) {
      return NextResponse.json(
        { error: "Wheel slots are not properly configured" },
        { status: 400 }
      );
    }

    // 3. One spin per successful transaction (idempotent)
    // If spin transaction already exists and is SPUN or COMPLETED, return the existing result
    const existingTx = order.spinTransaction;
    if (existingTx && (existingTx.status === "SPUN" || existingTx.status === "COMPLETED")) {
      const existingIndex = slots.findIndex((s) => s.id === existingTx.winningSlotId);
      return NextResponse.json({
        ok: true,
        alreadySpun: true,
        status: existingTx.status,
        winningIndex: existingIndex >= 0 ? existingIndex : 0,
        slot: {
          id: existingTx.winningSlotId,
          label: existingTx.winningRewardLabel,
          rewardAmount: existingTx.winningRewardAmount,
        },
      });
    }

    // 4. Server-side cryptographic weighted RNG outcome determination
    const winningSlot = pickWeightedSlot(slots);
    const winningIndex = slots.findIndex((s) => s.id === winningSlot.id);

    // 5. Ensure the transaction row exists in PENDING
    await prisma.randomSpinTransaction.upsert({
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

    // Atomically transition from PENDING -> SPUN
    const updated = await prisma.randomSpinTransaction.updateMany({
      where: {
        orderId: order.id,
        status: "PENDING",
      },
      data: {
        status: "SPUN",
        winningSlotId: winningSlot.id,
        winningRewardAmount: winningSlot.rewardAmount,
        winningRewardLabel: winningSlot.label,
        winningSupplierCode: winningSlot.supplierCode,
        winningSupplier: winningSlot.supplier,
        spunAt: new Date(),
        clientIp,
      },
    });

    if (updated.count === 0) {
      // Concurrently spun; return the won slot
      const existing = await prisma.randomSpinTransaction.findUnique({ where: { orderId: order.id } });
      const existingIdx = slots.findIndex((s) => s.id === existing?.winningSlotId);
      return NextResponse.json({
        ok: true,
        alreadySpun: true,
        status: existing?.status,
        winningIndex: existingIdx >= 0 ? existingIdx : 0,
        slot: existing
          ? {
              id: existing.winningSlotId,
              label: existing.winningRewardLabel,
              rewardAmount: existing.winningRewardAmount,
            }
          : winningSlot,
      });
    }

    return NextResponse.json({
      ok: true,
      status: "SPUN",
      winningIndex,
      slot: {
        id: winningSlot.id,
        label: winningSlot.label,
        rewardType: winningSlot.rewardType,
        rewardAmount: winningSlot.rewardAmount,
        probability: winningSlot.probability,
        color: winningSlot.color,
        icon: winningSlot.icon,
      },
    });
  } catch (err: any) {
    console.error("Error executing spin:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

