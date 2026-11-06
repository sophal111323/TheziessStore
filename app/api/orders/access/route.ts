import crypto from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { API_NO_STORE, safeJson } from "@/lib/apiSecurity";
import { applyRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getIp";
import { logSecurityEvent } from "@/lib/secureLogger";
import { logError } from "@/lib/errorLogger";
import {
  generateOrderToken,
  isOrderTokenConfigured,
  isRecoverablePlayerUid,
  normalizePlayerUid,
} from "@/lib/orderToken";

export const dynamic = "force-dynamic";

/**
 * Order-token recovery: a customer who lost the token link proves ownership
 * with the Player UID used on the order and receives the HMAC order token.
 *
 * Every failure (unknown order, wrong UID, non-recoverable placeholder UID)
 * returns the same generic 404 so the endpoint cannot be used as an oracle.
 */
const accessSchema = z.object({
  orderNumber: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9-]{3,40}$/)),
  playerUid: z.string().min(1).max(100),
});

const NOT_FOUND = { error: "Order not found or Player UID does not match." };

/** Constant-time string compare (hashing first equalises lengths). */
function timingSafeStringEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function POST(req: NextRequest) {
  if (!isOrderTokenConfigured()) {
    return safeJson(
      { error: "Order lookup is temporarily unavailable." },
      { status: 503 },
      API_NO_STORE
    );
  }

  const ip = getClientIp(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return safeJson({ error: "Invalid request" }, { status: 400 }, API_NO_STORE);
  }

  const parsed = accessSchema.safeParse(body);
  if (!parsed.success) {
    return safeJson({ error: "Invalid request" }, { status: 400 }, API_NO_STORE);
  }
  const { orderNumber, playerUid } = parsed.data;

  // Per-IP and per-order limits stop UID guessing against a single order.
  const ipLimited = await applyRateLimit(`order-access:ip:${ip}`, 10, 10 * 60 * 1000, ip);
  if (ipLimited) return ipLimited;

  // Tight limit per order + IP, so one attacker can't lock the real owner
  // out of recovery just by knowing the order number.
  const orderIpLimited = await applyRateLimit(
    `order-access:order-ip:${orderNumber}:${ip}`,
    5,
    15 * 60 * 1000,
    ip
  );
  if (orderIpLimited) return orderIpLimited;

  // Looser global cap per order still bounds distributed UID guessing.
  const orderLimited = await applyRateLimit(
    `order-access:order:${orderNumber}`,
    30,
    15 * 60 * 1000,
    ip
  );
  if (orderLimited) return orderLimited;

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: { orderNumber: true, playerUid: true },
    });

    const storedUid = normalizePlayerUid(order?.playerUid ?? "");
    const providedUid = normalizePlayerUid(playerUid);

    // Always run the compare so unknown orders take the same path as mismatches.
    const uidMatches = timingSafeStringEqual(storedUid, providedUid);

    if (!order || !isRecoverablePlayerUid(storedUid) || !uidMatches) {
      logSecurityEvent({
        event: "order_access_denied",
        detail: `Order token recovery denied: ${orderNumber}`,
        ip,
      });
      return safeJson(NOT_FOUND, { status: 404 }, API_NO_STORE);
    }

    return safeJson(
      { orderNumber: order.orderNumber, orderToken: generateOrderToken(order.orderNumber) },
      undefined,
      API_NO_STORE
    );
  } catch (err) {
    logError("Order access recovery error", err);
    return safeJson(
      { error: "Something went wrong. Please try again later." },
      { status: 500 },
      API_NO_STORE
    );
  }
}
