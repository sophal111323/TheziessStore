export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { generateOrderToken } from "@/lib/orderToken";

function safeOrderToken(orderNumber: string): string | null {
  try {
    return generateOrderToken(orderNumber);
  } catch {
    return null;
  }
}

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

    // Admin links open the customer order page, which requires the HMAC order token.
    const claimsWithToken = claims.map((c) => ({
      ...c,
      orderToken: safeOrderToken(c.orderNumber),
    }));

    return NextResponse.json(claimsWithToken);
  },
  { permission: "settings.read" }
);
