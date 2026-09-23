export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getIp";
import { prisma } from "@/lib/prisma";
import { validatePromoCode } from "@/lib/coupon";

const schema = z.object({
  code: z.string().min(1),
  orderAmountUsd: z.number().positive(),
  playerUid: z.string().optional().nullable(),
  gameId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  // Rate limit: 15 attempts per IP per 5 minutes to prevent brute-forcing
  const ip = getClientIp(req);
  const rl = await applyRateLimit(`promo-validate:${ip}`, 15, 5 * 60 * 1000, ip);
  if (rl) return rl;

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ valid: false, error: "Invalid request" }, { status: 400 });
    }

    const { code, orderAmountUsd, playerUid, gameId } = parsed.data;

    // Check system settings
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (settings?.promosEnabled === false) {
      return NextResponse.json(
        { valid: false, error: "Promo codes are temporarily disabled." },
        { status: 400 }
      );
    }

    const validation = await validatePromoCode({
      code,
      orderAmountUsd,
      playerUid: playerUid || undefined,
      gameId: gameId || undefined,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { valid: false, error: validation.error || "Coupon code is invalid or expired." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      message: "Coupon applied successfully",
      code: validation.code,
      discountType: validation.discountType,
      discountValue: validation.discountValue,
      discountUsd: validation.discountUsd,
      finalAmountUsd: validation.finalAmountUsd,
    });
  } catch (err) {
    console.error("Promo validation error:", err);
    return NextResponse.json({ valid: false, error: "Server error" }, { status: 500 });
  }
}
