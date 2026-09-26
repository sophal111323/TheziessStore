import { prisma } from "@/lib/prisma";
import { generateOrderNumber, isValidUid, calcKhr } from "@/lib/utils";
import { initiatePayment, getActivePaymentProvider } from "@/lib/payment";
import { startBackgroundPaymentTracker } from "@/lib/order-tracker";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getIp";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { recordAffiliateOrder } from "@/lib/affiliate/store";
import { validatePromoCode } from "@/lib/coupon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Parse a positive integer env var with clamped bounds and a safe default. */
function envInt(
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = (process.env[name] || "").trim();
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback;
  }
  return parsed;
}

// Order-creation rate limit (Issue #4) — env-tunable, defaults unchanged:
// 10 orders per IP per 10 minutes. Hard bounds prevent foot-guns
// (e.g. unlimited orders or a sub-second window).
const ORDER_RATE_LIMIT_MAX = envInt("ORDER_RATE_LIMIT_MAX", 10, 1, 1000);
const ORDER_RATE_LIMIT_WINDOW_MS = envInt(
  "ORDER_RATE_LIMIT_WINDOW_MS",
  10 * 60 * 1000,
  1_000,
  24 * 60 * 60 * 1000
);

const createOrderSchema = z
  .object({
    gameId: z.string().min(1),
    productId: z.string().optional(),
    randomPackageId: z.string().optional(),
    playerUid: z.string().max(100).optional(),
    serverId: z.string().optional(),
    customerEmail: z.string().email().optional(),
    customerPhone: z.string().optional(),
    paymentMethod: z.enum(["TOLASAINT", "ABA", "ACLEDA", "WING", "KHQR", "KHQRPAY"]),
    promoCode: z.string().optional(),
    playerNickname: z.string().max(100).optional(),
    turnstileToken: z.string().min(1),
  })
  .refine((d) => d.productId || d.randomPackageId, {
    message: "Either productId or randomPackageId is required",
  });

export async function POST(req: NextRequest) {

  // ── Rate limit: tunable per-IP order creation limit (Issue #4) ─────────
  // Defaults preserve the historical 10 orders / 10 minutes / IP.
  // Full guest-checkout auth stack for POST /api/orders (no user accounts
  // by design — orders are placed as guests):
  //   1. middleware origin guard (browser callers must be same-origin or
  //      explicitly allowlisted via API_ALLOWED_ORIGINS),
  //   2. Cloudflare Turnstile (verifyTurnstileToken below),
  //   3. this DB-backed per-IP rate limit (survives restarts & multi-instance),
  //   4. zod validation + banlist checks.
  // Admin order access uses GET /api/orders (withAdminAuth).
  const ip = getClientIp(req);
  const rl = await applyRateLimit(
    `orders:${ip}`,
    ORDER_RATE_LIMIT_MAX,
    ORDER_RATE_LIMIT_WINDOW_MS,
    ip
  );
  if (rl) return rl;

  try {
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // 🛡️ Cloudflare Turnstile Bot Validation:
    // Verify token BEFORE executing any database queries or external banking API calls
    const isBotChallengePassed = await verifyTurnstileToken({
      req,
      token: data.turnstileToken,
      kind: "public",
      expectedAction: "create_order",
    });

    if (!isBotChallengePassed) {
      return NextResponse.json(
        {
          error: "ការផ្ទៀងផ្ទាត់សុវត្ថិភាពមិនជោគជ័យ (Bot verification failed). សូម refresh ទំព័រ រួចសាកល្បងម្ដងទៀត។",
        },
        { status: 403 }
      );
    }

    // Maintenance mode blocks new orders site-wide.
    const maintSettings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (maintSettings?.maintenanceMode) {
      return NextResponse.json(
        { error: maintSettings.maintenanceMessage || "Ordering is temporarily disabled for maintenance." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (maintSettings?.ordersEnabled === false) {
      return NextResponse.json(
        { error: "Orders are temporarily disabled." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (maintSettings?.paymentsEnabled === false) {
      return NextResponse.json(
        { error: "Payments are temporarily disabled." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Validate game + product/randomPackage match and pricing
    const [game, settings] = await Promise.all([
      prisma.game.findUnique({ where: { id: data.gameId } }),
      prisma.settings.findUnique({ where: { id: 1 } }),
    ]);

    if (!game || !game.active) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const isVoucherGame =
      game.slug.toLowerCase().includes("roblox") ||
      game.slug.toLowerCase().includes("voucher") ||
      (game.currencyName && game.currencyName.toLowerCase().includes("voucher"));

    if (isVoucherGame) {
      if (!data.playerUid || !data.playerUid.trim()) {
        data.playerUid = "ROBLOX-USER";
      }
    } else {
      if (!data.playerUid || !isValidUid(data.playerUid)) {
        return NextResponse.json({ error: "Invalid UID format" }, { status: 400 });
      }
    }

    // Banlist: block orders from flagged emails, phones, IPs or UIDs.
    const ipAddress = getClientIp(req);
    const banCandidates = [
      { type: "email", value: data.customerEmail?.toLowerCase() },
      { type: "phone", value: data.customerPhone?.toLowerCase() },
      { type: "ip", value: ipAddress.toLowerCase() },
      { type: "uid", value: data.playerUid ? data.playerUid.toLowerCase() : undefined },
    ].filter((c): c is { type: string; value: string } => !!c.value);

    if (banCandidates.length > 0) {
      const blocked = await prisma.blockedIdentity.findFirst({
        where: { OR: banCandidates.map((c) => ({ type: c.type, value: c.value })) },
      });
      if (blocked) {
        return NextResponse.json(
          { error: "This order cannot be processed. Contact support if you believe this is a mistake." },
          { status: 403 }
        );
      }
    }

    if (game.requiresServer && !data.serverId) {
      return NextResponse.json({ error: "Server is required for this game" }, { status: 400 });
    }

    let product = null;
    let randomPackage = null;

    if (data.randomPackageId) {
      randomPackage = await prisma.randomPackage.findUnique({
        where: { id: data.randomPackageId },
        include: { slots: true },
      });
      if (!randomPackage || !randomPackage.active || randomPackage.gameId !== game.id) {
        return NextResponse.json({ error: "Mystery Box package not found" }, { status: 404 });
      }
      if ((randomPackage as any).inStock === false) {
        return NextResponse.json(
          { error: "កញ្ចប់នេះអស់ពីស្តុកហើយ មិនអាចកុម្ម៉ង់បានទេ (This package is currently out of stock)." },
          { status: 400 }
        );
      }
      if (randomPackage.slots.length < 2) {
        return NextResponse.json({ error: "Mystery Box is not configured properly" }, { status: 400 });
      }

      // Check time-based restrictions (daily spin limit)
      if (randomPackage.maxSpinsPerUserDaily) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const spinsToday = await prisma.randomSpinTransaction.count({
          where: {
            playerUid: data.playerUid,
            createdAt: { gte: startOfDay },
          },
        });
        if (spinsToday >= randomPackage.maxSpinsPerUserDaily) {
          return NextResponse.json(
            { error: `អ្នកអាចបង្វិលបានត្រឹម ${randomPackage.maxSpinsPerUserDaily} ដងក្នុងមួយថ្ងៃ` },
            { status: 400 }
          );
        }
      }

      if (data.productId) {
        product = await prisma.product.findUnique({ where: { id: data.productId } });
      }
      if (!product) {
        product = await prisma.product.findFirst({ where: { gameId: game.id, active: true } });
      }
      if (!product) {
        return NextResponse.json({ error: "No products available for this game" }, { status: 404 });
      }
    } else {
      product = await prisma.product.findUnique({ where: { id: data.productId! } });
      if (!product || !product.active || product.gameId !== game.id) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      if (product.inStock === false) {
        return NextResponse.json(
          { error: "ទំនិញនេះអស់ពីស្តុកហើយ មិនអាចកុម្ម៉ង់បានទេ (This item is currently out of stock)." },
          { status: 400 }
        );
      }
    }

    // Create the order
    const orderNumber = generateOrderNumber();
    const userAgent = req.headers.get("user-agent") ?? "unknown";
    const exchangeRate = settings?.exchangeRate ?? 4100;
    const basePriceUsd = randomPackage ? randomPackage.priceUsd : product.priceUsd;
    let finalPrice = basePriceUsd;

    // ── Promo code handling (Apply ≠ Consume) ────────────────────────────────
    // When the order is placed, validate the coupon against the player UID and
    // order amount, and create a PENDING CouponUsage record.
    // The coupon is ONLY consumed and counted as used after payment + top-up succeed!
    let promoCodeId: string | null = null;
    let discountUsd = 0;

    if (data.promoCode) {
      if (settings?.promosEnabled === false) {
        return NextResponse.json(
          { error: "Promo codes are temporarily disabled." },
          { status: 503, headers: { "Cache-Control": "no-store" } }
        );
      }

      const validation = await validatePromoCode({
        code: data.promoCode,
        orderAmountUsd: basePriceUsd,
        playerUid: data.playerUid,
        gameId: game.id,
      });

      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || "Coupon code is invalid or expired." },
          { status: 400 }
        );
      }

      promoCodeId = validation.promoCodeId || null;
      discountUsd = validation.discountUsd || 0;
      finalPrice = validation.finalAmountUsd || basePriceUsd;
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        gameId: game.id,
        productId: product.id,
        isRandomSpin: Boolean(randomPackage),
        randomPackageId: randomPackage?.id || null,
        playerUid: data.playerUid,
        serverId: data.serverId,
        playerNickname: data.playerNickname,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        amountUsd: finalPrice,
        amountKhr: calcKhr(finalPrice, exchangeRate),
        paymentMethod: data.paymentMethod,
        status: "PENDING",
        ipAddress,
        userAgent,
        promoCodeId,
        discountUsd,
        couponUsage: promoCodeId
          ? {
              create: {
                promoCodeId,
                userIdentifier: data.playerUid.trim().toLowerCase(),
                status: "PENDING",
                discountUsd,
              },
            }
          : undefined,
      },
    });

    // ── Track affiliate promoter attribution ($0.04 fixed commission) ──────
    const affiliateCookie = req.cookies.get("theziess_affiliate")?.value;
    if (affiliateCookie) {
      try {
        recordAffiliateOrder({
          orderNumber: order.orderNumber,
          affiliateSlug: decodeURIComponent(affiliateCookie),
          gameName: game.name,
          gameSlug: game.slug,
          productName: randomPackage ? randomPackage.name : product.name,
          amountUsd: order.amountUsd,
        });
      } catch (affErr) {
        console.error("Failed to record affiliate order:", affErr);
      }
    }

    // Initiate payment with the gateway
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")).replace(/\/+$/, "");
    // Prefer PUBLIC_APP_URL (tunnel/production domain) for gateway callbacks
    // so webhooks actually reach us. Falls back to baseUrl; the payment lib
    // strips localhost URLs automatically (the gateway refuses private IPs).
    const publicUrl = (process.env.PUBLIC_APP_URL || baseUrl).replace(/\/+$/, "");
    const activeProvider = getActivePaymentProvider();
    const webhookPath = activeProvider === "khqrpay" ? "khqrpay" : "tolasaint";
    const init = await initiatePayment({
      orderNumber: order.orderNumber,
      amountUsd: order.amountUsd,
      currency: order.currency,
      method: data.paymentMethod as any,
      returnUrl: `${publicUrl}/order?number=${order.orderNumber}`,
      cancelUrl: `${publicUrl}/games/${game.slug}`,
      callbackUrl: `${publicUrl}/api/payment/webhook/${webhookPath}`,
      note: randomPackage
        ? `TheziessStore · ${game.name} · ${randomPackage.name}`
        : `TheziessStore · ${game.name} · ${product.name}`,
      customerEmail: data.customerEmail,
      metadata: {
        game_slug: game.slug,
        product_name: randomPackage ? randomPackage.name : product.name,
        player_uid: data.playerUid,
        is_random_spin: randomPackage ? "true" : "false",
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentRef: init.paymentRef,
        paymentUrl: init.redirectUrl,
        qrString: init.qrString ?? null,
        paymentExpiresAt: init.expiresAt,
      },
    });

    if (init.paymentRef && !init.paymentRef.startsWith("SIM-")) {
      startBackgroundPaymentTracker(order.orderNumber);
    }

    return NextResponse.json({
      orderNumber: order.orderNumber,
      redirectUrl: `${baseUrl}/checkout/${order.orderNumber}`,
    });
  } catch (err) {
    console.error("Order create error:", err);
    // Security: never expose internal error messages to public users
    return NextResponse.json(
      { error: "Something went wrong. Please try again or contact support." },
      { status: 500 }
    );
  }
}

/**
 * Admin-only order list. The public site/app never lists all orders — they
 * track a single order via GET /api/orders/[orderNumber]. Without a valid admin
 * session this returns 401 (JSON); without the orders.read permission, 403.
 * Returns an explicit safe-field allowlist (no ipAddress, userAgent, customer
 * PII, adminNote, cost/profit, or secrets).
 */
export const GET = withAdminAuth(
  async () => {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        orderNumber: true,
        status: true,
        amountUsd: true,
        amountKhr: true,
        currency: true,
        paymentMethod: true,
        createdAt: true,
        paidAt: true,
        deliveredAt: true,
        game: { select: { name: true, slug: true } },
        product: { select: { name: true } },
      },
    });
    return NextResponse.json(orders, { headers: { "Cache-Control": "no-store" } });
  },
  { permission: "orders.read" }
);
