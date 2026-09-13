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

const updatePackageSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  priceUsd: z.number().positive().optional(),
  priceKhr: z.number().positive().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  bannerUrl: z.string().optional().nullable(),
  badge: z.string().optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  maxSpinsPerUserDaily: z.number().int().positive().optional().nullable(),
  slots: z.array(slotSchema).min(2).optional(),
});

export const GET = withAdminAuth<{ id: string }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const pkg = await prisma.randomPackage.findUnique({
    where: { id },
    include: {
      game: true,
      slots: { orderBy: { sortOrder: "asc" } },
      _count: { select: { transactions: true } },
    },
  });

  if (!pkg) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  return NextResponse.json(pkg);
});

export const PUT = withAdminAuth<{ id: string }>(async (req, ctx, admin) => {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = updatePackageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check if package exists
    const existing = await prisma.randomPackage.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Validate slots probability if slots are provided
    if (data.slots) {
      const totalProb = data.slots.reduce((s, slot) => s + slot.probability, 0);
      if (totalProb < 98 || totalProb > 102) {
        return NextResponse.json(
          {
            error: `Total slot probability must sum to 100% (currently ${totalProb.toFixed(1)}%)`,
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update package details
      await tx.randomPackage.update({
        where: { id },
        data: {
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

      // If slots are provided, recreate them
      if (data.slots) {
        await tx.randomPackageSlot.deleteMany({ where: { packageId: id } });
        await tx.randomPackageSlot.createMany({
          data: data.slots.map((slot, index) => ({
            packageId: id,
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
      }

      return tx.randomPackage.findUnique({
        where: { id },
        include: { slots: { orderBy: { sortOrder: "asc" } }, game: true },
      });
    });

    await writeAuditForAdmin(admin, req, {
      action: "UPDATE",
      targetType: "RandomPackage",
      targetId: id,
      details: `Updated package ${id}`,
    });

    revalidateAdminChange("products");
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("Error updating random package:", err);
    return NextResponse.json({ error: "Failed to update package" }, { status: 500 });
  }
});

export const DELETE = withAdminAuth<{ id: string }>(async (req, ctx, admin) => {
  try {
    const { id } = await ctx.params;
    const existing = await prisma.randomPackage.findUnique({
      where: { id },
      include: { _count: { select: { transactions: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // If transactions exist, soft-delete by deactivating to preserve order history
    if (existing._count.transactions > 0) {
      await prisma.randomPackage.update({
        where: { id },
        data: { active: false },
      });
    } else {
      await prisma.randomPackage.delete({ where: { id } });
    }

    await writeAuditForAdmin(admin, req, {
      action: "DELETE",
      targetType: "RandomPackage",
      targetId: id,
      details: `Deleted or deactivated package ${id}`,
    });

    revalidateAdminChange("products");
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Error deleting random package:", err);
    return NextResponse.json({ error: "Failed to delete package" }, { status: 500 });
  }
});

