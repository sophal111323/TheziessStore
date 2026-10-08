export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getIp";
import { prisma } from "@/lib/prisma";
import { validatePromoCode } from "@/lib/coupon";

const schema = z.object({
  code: z.string().min(1),
  orderAmountUsd: z.number().positive().optional().nullable(),
  playerUid: z.string().optional().nullable(),
  gameId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  claim: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ valid: false, error: "ទិន្នន័យមិនត្រឹមត្រូវ" }, { status: 400 });
    }

    const { code, orderAmountUsd, playerUid, gameId, productId, claim } = parsed.data;
    const normalizedCode = code.toUpperCase().trim();

    // 🛡️ Intelligent Rate Limiting:
    // 1. Per Code + IP: Allows 30 attempts per minute for the exact same code.
    //    Trying a NEW / DIFFERENT promo code is never blocked!
    const codeLimit = await applyRateLimit(`promo-c:${ip}:${normalizedCode}`, 30, 60 * 1000, ip);
    if (codeLimit) {
      return NextResponse.json(
        { valid: false, error: "អ្នកបានសាកល្បងកូដនេះញឹកញាប់ពេក សូមរង់ចាំបន្តិច" },
        { status: 429 }
      );
    }

    // 2. Global Safety limit per IP: 120 attempts per minute (generous for shared mobile network CGNAT in Cambodia)
    const ipLimit = await applyRateLimit(`promo-ip:${ip}`, 120, 60 * 1000, ip);
    if (ipLimit) {
      return NextResponse.json(
        { valid: false, error: "មានសំណើច្រើនពេក សូមរង់ចាំបន្តិចមុននឹងសាកល្បងម្តងទៀត" },
        { status: 429 }
      );
    }

    // Check system settings
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (settings?.promosEnabled === false) {
      return NextResponse.json(
        { valid: false, error: "កូដបញ្ចុះតម្លៃត្រូវបានផ្អាកបណ្តោះអាសន្ន" },
        { status: 400 }
      );
    }

    const validation = await validatePromoCode({
      code: normalizedCode,
      orderAmountUsd: orderAmountUsd || null,
      playerUid: playerUid || undefined,
      gameId: gameId || undefined,
      productId: productId || undefined,
      claimNow: claim !== false,
    });

    if (!validation.valid) {
      return NextResponse.json(
        {
          valid: false,
          error: validation.error || "កូដបញ្ចុះតម្លៃមិនត្រឹមត្រូវ ឬត្រូវបានប្រើអស់ហើយ",
          allowedPackageIds: validation.allowedPackageIds || [],
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      claimed: validation.claimed,
      message: validation.claimed ? "បាន Claim និងអនុវត្តកូដជោគជ័យ!" : "អនុវត្តកូដបញ្ចុះតម្លៃជោគជ័យ",
      code: validation.code,
      discountType: validation.discountType,
      discountValue: validation.discountValue,
      discountUsd: validation.discountUsd,
      finalAmountUsd: validation.finalAmountUsd,
      gameId: validation.gameId,
      allowedPackageIds: validation.allowedPackageIds || [],
    });
  } catch (err) {
    console.error("Promo validation error:", err);
    return NextResponse.json({ valid: false, error: "មានបញ្ហាបច្ចេកទេសបណ្តោះអាសន្ន" }, { status: 500 });
  }
}
