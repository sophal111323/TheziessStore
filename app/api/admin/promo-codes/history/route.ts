export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";

export const GET = withAdminAuth(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const codeId = searchParams.get("codeId");
    const search = searchParams.get("search");

    const usages = await prisma.couponUsage.findMany({
      where: {
        ...(codeId ? { promoCodeId: codeId } : {}),
        ...(search
          ? {
              OR: [
                { userIdentifier: { contains: search, mode: "insensitive" } },
                { promoCode: { code: { contains: search, mode: "insensitive" } } },
                { order: { orderNumber: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        promoCode: {
          select: {
            id: true,
            code: true,
            discountType: true,
            discountValue: true,
            game: { select: { id: true, name: true } },
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            amountUsd: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json(usages);
  },
  { permission: "promoCodes.read" }
);
