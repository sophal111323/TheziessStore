import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import {
  verifyWebhook,
  fetchPaymentStatus,
  resolveWebhookProvider,
  parseTolaSaintWebhookEvent,
  parseKhqrpayWebhookEvent,
  parseJlaWebhookEvent,
} from "@/lib/payment";
import { NextRequest, NextResponse } from "next/server";
import { logSecurityEvent } from "@/lib/secureLogger";
import { getClientIp } from "@/lib/getIp";
import { isIpAllowedByEnv } from "@/lib/ipAllowlist";
import { isRemotePaid } from "@/lib/payment-validation";
import { syncAndConfirmOrderPayment } from "@/lib/payment-sync";
import { publicRateLimit } from "@/lib/apiSecurity";
import { checkRateLimitMemory } from "@/lib/rateLimit";
import { releaseOrCancelCouponUsage } from "@/lib/coupon";
import type { Order } from "@prisma/client";

class OrderStatusChangedError extends Error {}

function isPrismaUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

type WebhookHint = "paid" | "expired" | "failed" | "ignore";

const TERMINAL_REMOTE_STATUSES = new Set(["EXPIRED", "FAILED", "CANCELLED"]);

const WEBHOOK_GATEWAY_QUERIES_PER_ORDER = 6;
const WEBHOOK_GATEWAY_QUERY_WINDOW_MS = 60_000;

/**
 * Payment gateway webhook.
 *
 * Security model (ATK-01): the webhook is only a hint.
 *  - The URL method alone picks the provider; that provider's signature check
 *    and parser are the only ones used (no body/header sniffing).
 *  - "paid" never marks an order PAID here: syncAndConfirmOrderPayment queries
 *    the gateway server-side and validates remote amount/currency/binding.
 *  - "failed"/"expired" only cancel a PENDING order when the gateway itself
 *    reports a terminal non-paid status.
 *  - Body amount/currency/paymentRef are never trusted or written.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ method: string }> }
) {
  try {
    const { method: methodParam } = await params;
    const provider = resolveWebhookProvider(methodParam);

    if (!provider) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }

    const method = String(methodParam).trim().toUpperCase();
    const ip = getClientIp(req);

    const limited = publicRateLimit(req, `payment-webhook:` + method, {
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    // Optional IP allowlist for Tola Saint
    if (provider === "tolasaint" && process.env.TOLA_SAINT_WEBHOOK_ALLOWED_IPS) {
      const ipGuard = isIpAllowedByEnv(ip, process.env.TOLA_SAINT_WEBHOOK_ALLOWED_IPS);
      if (!ipGuard.allowed) {
        logSecurityEvent({
          event: "webhook_ip_blocked",
          detail: `Tola Saint webhook from non-allowlisted IP (${method})`,
          ip,
        });
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // 1. RAW request body - required for exact HMAC verification.
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    // 2. Verify signature with the URL-selected provider only
    const valid = verifyWebhook(method, rawBody, headers);
    if (!valid) {
      logSecurityEvent({
        event: "webhook_invalid_signature",
        detail: method,
        ip,
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      try {
        const parsed = Object.fromEntries(new URLSearchParams(rawBody).entries());
        if (Object.keys(parsed).length > 0) {
          payload = parsed;
        } else {
          return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      }
    }

    // 3. Parse with that provider's parser only and locate the order.
    let hint: WebhookHint = "ignore";
    let rawStatus = "";
    let order: Order | null = null;
    let lookupDetail = "";

    if (provider === "khqrpay") {
      const event = parseKhqrpayWebhookEvent(payload);
      if (!event || !event.id) {
        logSecurityEvent({
          event: "payment_missing_ref",
          detail: "khqrpay webhook missing payment id",
          ip,
        });
        return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
      }

      rawStatus = event.status;
      if (event.status === "paid" || event.status === "expired" || event.status === "failed") {
        hint = event.status;
      } else {
        return NextResponse.json({ ok: true, ignored: true, status: event.status });
      }

      lookupDetail = `paymentRef=${event.id}`;
      order = await prisma.order.findUnique({ where: { paymentRef: event.id } });
    } else if (provider === "jla") {
      const event = parseJlaWebhookEvent(payload);
      const orderNumber = String(event?.orderNumber ?? "").trim().toUpperCase();
      if (!event || !orderNumber) {
        logSecurityEvent({
          event: "payment_missing_ref",
          detail: "JLA webhook missing tran_id (order number)",
          ip,
        });
        return NextResponse.json({ error: "Missing payment identifiers" }, { status: 400 });
      }

      rawStatus = event.status;
      if (event.status === "pending") {
        return NextResponse.json({ ok: true, ignored: true, status: "pending" });
      }
      hint = event.status;

      lookupDetail = `orderNumber=${orderNumber}`;
      order = await prisma.order.findUnique({ where: { orderNumber } });
    } else {
      const event = parseTolaSaintWebhookEvent(payload);
      if (!event) {
        logSecurityEvent({
          event: "payment_missing_ref",
          detail: "webhook payload missing payment id",
          ip,
        });
        return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
      }

      rawStatus = event.status;
      if (event.status !== "paid" && event.status !== "expired" && event.status !== "failed") {
        return NextResponse.json({ ok: true, ignored: true, status: event.status });
      }
      hint = event.status;

      const orderNumber = String(event.reference ?? "").trim().toUpperCase();
      if (!orderNumber) {
        logSecurityEvent({
          event: "payment_missing_ref",
          detail: `webhook ${event.status}: no reference on payment ${event.id}`,
          ip,
        });
        return NextResponse.json({ error: "Missing payment reference" }, { status: 400 });
      }

      lookupDetail = `orderNumber=${orderNumber}; paymentId=${event.id}`;
      order = await prisma.order.findUnique({ where: { orderNumber } });

      if (order && order.paymentRef !== event.id) {
        logSecurityEvent({
          event: "payment_transaction_mismatch",
          detail: `webhook ${event.status}: got=${event.id}; expected=${order.paymentRef || "missing"}; order=${order.orderNumber}`,
          ip,
        });
        return NextResponse.json(
          { error: "Payment transaction does not match order" },
          { status: 400 }
        );
      }
    }

    if (!order) {
      logSecurityEvent({
        event: "webhook_order_mismatch",
        detail: `${provider} order not found; ${lookupDetail}`,
        ip,
      });
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Every actionable hint below queries the gateway. Cap that per order so
    // forged hints (unsigned providers, spoofed per-IP buckets) cannot turn
    // this endpoint into an unlimited gateway caller (review R-4). Real
    // gateways send one or two callbacks per order; 429 makes them retry.
    if (
      !checkRateLimitMemory(
        `payment-webhook-order:${provider}:${order.orderNumber}`,
        WEBHOOK_GATEWAY_QUERIES_PER_ORDER,
        WEBHOOK_GATEWAY_QUERY_WINDOW_MS
      )
    ) {
      logSecurityEvent({
        event: "rate_limit_exceeded",
        detail: `${provider} webhook gateway queries capped; order=${order.orderNumber}`,
        ip,
      });
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(WEBHOOK_GATEWAY_QUERY_WINDOW_MS / 1000)) },
        }
      );
    }

    // 4A. "paid" hint: confirm with the gateway server-side. This is the only
    //     path that can move the order to PAID (atomic PENDING -> PAID inside).
    if (hint === "paid") {
      const result = await syncAndConfirmOrderPayment(order.orderNumber, {
        source: "webhook",
        ignoreExpiry: true,
      });

      if (!result.paid) {
        logSecurityEvent({
          event: "payment_validation_failed",
          detail: `${provider} webhook paid hint not confirmed by gateway; order=${order.orderNumber}; status=${result.status || "unknown"}`,
          ip,
        });
      }

      return NextResponse.json({ ok: true, confirmed: result.paid });
    }

    // 4B. "failed"/"expired" hint: act only when the gateway agrees.
    if (order.status !== "PENDING" || !order.paymentRef) {
      return NextResponse.json({ ok: true, ignored: true, status: rawStatus });
    }

    const remote = await fetchPaymentStatus(
      order.paymentRef,
      order.paymentProvider,
      order.orderNumber
    );
    const remoteStatus = String(remote?.status ?? "").trim().toUpperCase();

    if (!remote || isRemotePaid(remote) || !TERMINAL_REMOTE_STATUSES.has(remoteStatus)) {
      return NextResponse.json({ ok: true, ignored: true, status: rawStatus });
    }

    const newStatus: "CANCELLED" | "FAILED" = remoteStatus === "FAILED" ? "FAILED" : "CANCELLED";
    const pendingOrder = { id: order.id, orderNumber: order.orderNumber, paymentRef: order.paymentRef };

    try {
      await prisma.$transaction(async (tx) => {
        await tx.processedWebhookEvent.create({
          data: {
            transactionId: pendingOrder.paymentRef,
            orderNumber: pendingOrder.orderNumber,
            processedAt: new Date(),
          },
        });

        const updated = await tx.order.updateMany({
          where: { id: pendingOrder.id, status: "PENDING" },
          data: {
            status: newStatus,
            failureReason: `${provider}: ${remoteStatus.toLowerCase()}`,
          },
        });

        if (updated.count !== 1) {
          throw new OrderStatusChangedError();
        }
      });
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        return NextResponse.json({ ok: true, skipped: true, reason: "replay" });
      }
      if (error instanceof OrderStatusChangedError) {
        return NextResponse.json({ ok: true, ignored: true, status: rawStatus });
      }
      throw error;
    }

    await releaseOrCancelCouponUsage(pendingOrder.id, newStatus);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
