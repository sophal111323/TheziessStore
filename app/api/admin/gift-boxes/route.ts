export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { getOrCreateGiftBoxSlots } from "@/lib/giftBox";
import { z } from "zod";

const updateSlotsSchema = z.object({
  slots: z.array(
    z.object({
      id: z.string().optional(),
      slotNumber: z.number().int().min(1).max(9),
      label: z.string().min(1),
      rewardType: z.enum(["GAME_PACKAGE", "PROMO_CODE", "DIAMOND", "CUSTOM", "THANK_YOU"]),
      rewardValue: z.string().nullable().optional(),
      rewardAmount: z.number().int().min(0).default(0),
      productId: z.string().nullable().optional(),
      promoCodeId: z.string().nullable().optional(),
      supplier: z.string().default("bay2game"),
      supplierCode: z.string().nullable().optional(),
      inStock: z.boolean().default(true),
      probability: z.number().min(0).max(100),
      color: z.string().default("#9333ea"),
      icon: z.string().default("🎁"),
      active: z.boolean().default(true),
    })
  ),
});

export const GET = withAdminAuth(
  async () => {
    const [settings, slots, totalClaims] = await Promise.all([
      prisma.settings.findUnique({ where: { id: 1 } }),
      getOrCreateGiftBoxSlots(),
      prisma.giftClaim.count(),
    ]);

    return NextResponse.json({
      eventEnabled: settings?.giftEventEnabled !== false,
      slots,
      totalClaims,
    });
  },
  { permission: "settings.read" }
);

export const PUT = withAdminAuth(
  async (req: NextRequest) => {
    const body = await req.json().catch(() => ({}));
    const parsed = updateSlotsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid slot data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { slots } = parsed.data;

    // Bulk update the 9 slots
    await prisma.$transaction(async (tx) => {
      for (const slot of slots) {
        await tx.giftBoxSlot.upsert({
          where: { slotNumber: slot.slotNumber },
          create: {
            slotNumber: slot.slotNumber,
            label: slot.label,
            rewardType: slot.rewardType,
            rewardValue: slot.rewardValue || null,
            rewardAmount: slot.rewardAmount,
            productId: slot.productId || null,
            promoCodeId: slot.promoCodeId || null,
            supplier: slot.supplier || "bay2game",
            supplierCode: slot.supplierCode || null,
            inStock: slot.inStock ?? true,
            probability: slot.probability,
            color: slot.color,
            icon: slot.icon || "🎁",
            active: slot.active,
          },
          update: {
            label: slot.label,
            rewardType: slot.rewardType,
            rewardValue: slot.rewardValue || null,
            rewardAmount: slot.rewardAmount,
            productId: slot.productId || null,
            promoCodeId: slot.promoCodeId || null,
            supplier: slot.supplier || "bay2game",
            supplierCode: slot.supplierCode || null,
            inStock: slot.inStock ?? true,
            probability: slot.probability,
            color: slot.color,
            icon: slot.icon || "🎁",
            active: slot.active,
          },
        });
      }
    });

    const updated = await prisma.giftBoxSlot.findMany({
      orderBy: { slotNumber: "asc" },
      include: {
        product: { select: { id: true, name: true, priceUsd: true } },
        promoCode: { select: { id: true, code: true, discountType: true, discountValue: true } },
      },
    });

    return NextResponse.json({ ok: true, slots: updated });
  },
  { permission: "settings.write" }
);
