import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { writeAuditForAdmin } from "@/lib/audit";
import { revalidateAdminChange } from "@/lib/adminRevalidate";

export const dynamic = "force-dynamic";

const slotSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  rewardType: z.string().default("DIAMOND"),
  rewardAmount: z.number().int().min(0),
  probability: z.number().min(0).max(100),
  color: z.string().default("#EC4899"),
  textColor: z.string().default("#FFFFFF"),
  icon: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
  supplier: z.string().default("bay2game"),
  supplierCode: z.string().optional().nullable(),
});

const createPackageSchema = z.object({
  gameId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  priceUsd: z.number().positive(),
  priceKhr: z.number().positive().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  bannerUrl: z.string().optional().nullable(),
  badge: z.string().optional().nullable().default("🔥 MYSTERY BOX"),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  maxSpinsPerUserDaily: z.number().int().positive().optional().nullable(),
  slots: z.array(slotSchema).min(2, "At least 2 slots are required for the wheel"),
});

export const GET = withAdminAuth(async (req) => {
  const gameId = req.nextUrl.searchParams.get("gameId") || undefined;
  const packages = await prisma.randomPackage.findMany({
    where: gameId ? { gameId } : undefined,
    include: {
      game: {
        select: { id: true, name: true, slug: true, imageUrl: true },
      },
      slots: {
        orderBy: { sortOrder: "asc" },
      },
      _count: {
        select: { transactions: true, orders: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(packages);
});

export const POST = withAdminAuth(async (req, _ctx, admin) => {
  try {
    const body = await req.json();
    const parsed = createPackageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate that total probability is approximately 100% (99.0 to 101.0)
    const totalProb = data.slots.reduce((s, slot) => s + slot.probability, 0);
    if (totalProb < 98 || totalProb > 102) {
      return NextResponse.json(
        {
          error: `Total slot probability must sum to 100% (currently ${totalProb.toFixed(1)}%)`,
        },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const pkg = await tx.randomPackage.create({
        data: {
          gameId: data.gameId,
          name: data.name,
          description: data.description,
          priceUsd: data.priceUsd,
          priceKhr: data.priceKhr,
          imageUrl: data.imageUrl,
          bannerUrl: data.bannerUrl,
          badge: data.badge,
          active: data.active,
          sortOrder: data.sortOrder,
          maxSpinsPerUserDaily: data.maxSpinsPerUserDaily,
        },
      });

      await tx.randomPackageSlot.createMany({
        data: data.slots.map((slot, index) => ({
          packageId: pkg.id,
          label: slot.label,
          rewardType: slot.rewardType,
          rewardAmount: slot.rewardAmount,
          probability: slot.probability,
          color: slot.color,
          textColor: slot.textColor,
          icon: slot.icon || "💎",
          sortOrder: slot.sortOrder ?? index,
          supplier: slot.supplier || "bay2game",
          supplierCode: slot.supplierCode,
        })),
      });

      return tx.randomPackage.findUnique({
        where: { id: pkg.id },
        include: { slots: { orderBy: { sortOrder: "asc" } }, game: true },
      });
    });

    await writeAuditForAdmin(admin, req, {
      action: "CREATE",
      targetType: "RandomPackage",
      targetId: created?.id,
      details: `Created random package "${data.name}" with ${data.slots.length} slots`,
    });

    revalidateAdminChange("products");
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    console.error("Error creating random package:", err);
    return NextResponse.json({ error: "Failed to create random package" }, { status: 500 });
  }
});

