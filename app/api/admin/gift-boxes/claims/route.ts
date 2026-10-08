export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";

export const GET = withAdminAuth(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const claims = await prisma.giftClaim.findMany({
      where: search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: "insensitive" } },
              { playerUid: { contains: search, mode: "insensitive" } },
              { rewardTitle: { contains: search, mode: "insensitive" } },
              { promoCodeStr: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: { claimedAt: "desc" },
      take: 100,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            amountUsd: true,
            game: { select: { name: true } },
            product: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json(claims);
  },
  { permission: "settings.read" }
);
