import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import {
  verifyWebhook,
  parseTolaSaintWebhookEvent,
  parseKhqrpayWebhookEvent,
  fetchKhqrpayStatus,
} from "@/lib/payment";
import { NextRequest, NextResponse } from "next/server";
import { logSecurityEvent } from "@/lib/secureLogger";
import { getClientIp } from "@/lib/getIp";
import { isIpAllowedByEnv } from "@/lib/ipAllowlist";
import {
  logPaymentValidationFailure,
  validatePaymentForOrder,
  amountsMatch,
} from "@/lib/payment-validation";
import { notifyAndMaybeDeliverPaidOrder } from "@/lib/order-fulfillment";
import { publicRateLimit } from "@/lib/apiSecurity";

function isPrismaUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ method: string }> }
) {
  try {
    const { method: methodParam } = await params;
    const method = (methodParam || "").toUpperCase();
    const isSupported =
      method === "KHQRPAY" ||
      method === "TOLASAINT" ||
      method === "ABA" ||
      method === "BAKONG" ||
      method === "KHQR" ||
      method === "1";

    if (!isSupported) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }

    const limited = publicRateLimit(req, `payment-webhook:` + method, {
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    // Optional IP allowlist for Tola Saint
    if (method === "TOLASAINT" && process.env.TOLA_SAINT_WEBHOOK_ALLOWED_IPS) {
      const ipGuard = isIpAllowedByEnv(
        getClientIp(req),
        process.env.TOLA_SAINT_WEBHOOK_ALLOWED_IPS
      );
      if (!ipGuard.allowed) {
        logSecurityEvent({
          event: "webhook_ip_blocked",
          detail: `Tola Saint webhook from non-allowlisted IP (${method})`,
          ip: getClientIp(req),
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

    // 2. Verify signature
    const valid = verifyWebhook(method, rawBody, headers);
    if (!valid) {
      logSecurityEvent({
        event: "webhook_invalid_signature",
        detail: method,
        ip: getClientIp(req),
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const isKhqrpayEvent =
      method === "KHQRPAY" ||
      headers["x-webhook-event"] === "payment.update" ||
      payload?.event === "payment.update" ||
      (payload?.id && (payload?.type === "aba" || payload?.type === "bakong"));

    // ─────────────────────────────────────────────────────────────────────────
    // 3A. Process KHQR Pay (khqrpay.site) Webhook
    // ─────────────────────────────────────────────────────────────────────────
    if (isKhqrpayEvent) {
      const event = parseKhqrpayWebhookEvent(payload);
      if (!event || !event.id) {
        logSecurityEvent({
          event: "payment_missing_ref",
          detail: "khqrpay webhook missing payment id",
          ip: getClientIp(req),
        });
        return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
      }

      if (event.status === "pending") {
        return NextResponse.json({ ok: true, ignored: true, status: "pending" });
      }

      const transactionId = event.id;

      // Find order by stored paymentRef
      const order = await prisma.order.findUnique({
        where: { paymentRef: transactionId },
      });

      if (!order) {
        logSecurityEvent({
          event: "webhook_order_mismatch",
          detail: `khqrpay order not found for paymentRef: ${transactionId}`,
          ip: getClientIp(req),
        });
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      if (event.status === "paid") {
        // If KHQRPAY_WEBHOOK_SECRET is not configured, confirm with gateway API directly
        if (!process.env.KHQRPAY_WEBHOOK_SECRET) {
          const remoteCheck = await fetchKhqrpayStatus(transactionId);
          if (!remoteCheck || !remoteCheck.paid) {
            logSecurityEvent({
              event: "payment_validation_failed",
              detail: `khqrpay remote check not paid for ${transactionId}`,
              ip: getClientIp(req),
            });
            return NextResponse.json({ error: "Remote payment verification failed" }, { status: 400 });
          }
        }

        // Validate amount
        if (event.amount && !amountsMatch(order.amountUsd, event.amount)) {
          logSecurityEvent({
            event: "payment_amount_mismatch",
            detail: `khqrpay amount mismatch: order=${order.orderNumber} expected=${order.amountUsd} got=${event.amount}`,
            ip: getClientIp(req),
          });
          return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
        }

        if (order.status !== "PENDING") {
          if (["PAID", "PROCESSING", "DELIVERED"].includes(order.status)) {
            return NextResponse.json({ ok: true, skipped: true, reason: "already_paid" });
          }
          return NextResponse.json(
            { error: "Order is not pending and cannot be marked paid" },
            { status: 409 }
          );
        }

        // Idempotent transition to PAID
        let fullOrder = null;
        try {
          fullOrder = await prisma.$transaction(async (tx: any) => {
            await tx.processedWebhookEvent.create({
              data: {
                transactionId,
                orderNumber: order.orderNumber,
                processedAt: new Date(),
              },
            });

            const updated = await tx.order.updateMany({
              where: {
                id: order.id,
                status: "PENDING",
                paymentRef: transactionId,
              },
              data: {
                status: "PAID",
                paidAt: new Date(),
              },
            });

            if (updated.count !== 1) {
              throw new Error("Order payment update lost a race or no longer matches paymentRef.");
            }

            return tx.order.findUnique({
              where: { id: order.id },
              include: { game: true, product: true },
            });
          });
        } catch (error) {
          if (isPrismaUniqueError(error)) {
            logSecurityEvent({
              event: "webhook_replay_blocked",
              detail: `transactionId=${transactionId}; order=${order.orderNumber}`,
            });
            return NextResponse.json({ ok: true, skipped: true, reason: "replay" });
          }
          throw error;
        }

        if (fullOrder) {
          await notifyAndMaybeDeliverPaidOrder(fullOrder.id);
        }
      } else if (event.status === "expired" || event.status === "failed") {
        if (order.status === "PENDING") {
          try {
            await prisma.$transaction(async (tx: any) => {
              await tx.processedWebhookEvent.create({
                data: {
                  transactionId,
                  orderNumber: order.orderNumber,
                  processedAt: new Date(),
                },
              });

              await tx.order.update({
                where: { id: order.id },
                data: {
                  status: event.status === "expired" ? "CANCELLED" : "FAILED",
                  failureReason: `KHQR Pay: ${event.status}`,
                },
              });
            });
          } catch (error) {
            if (isPrismaUniqueError(error)) {
              return NextResponse.json({ ok: true, skipped: true, reason: "replay" });
            }
            throw error;
          }
        }
      }

      return NextResponse.json({ ok: true });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3B. Process Tola Saint Webhook
    // ─────────────────────────────────────────────────────────────────────────
    const event = parseTolaSaintWebhookEvent(payload);
    if (!event) {
      logSecurityEvent({
        event: "payment_missing_ref",
        detail: "webhook payload missing payment id",
        ip: getClientIp(req),
      });
      return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
    }

    if (["pending", "scanned", "processing"].includes(event.status)) {
      return NextResponse.json({ ok: true, ignored: true, status: event.status });
    }

    const transactionId = event.id;
    const orderNumber = String(event.reference ?? "").trim().toUpperCase();

    if (!orderNumber) {
      logSecurityEvent({
        event: "payment_missing_ref",
        detail: `webhook ${event.status}: no reference on payment ${transactionId}`,
        ip: getClientIp(req),
      });
      return NextResponse.json({ error: "Missing payment reference" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { orderNumber } });
    if (!order) {
      logSecurityEvent({
        event: "webhook_order_mismatch",
        detail: `order not found; orderNumber=${orderNumber}; paymentId=${transactionId}`,
        ip: getClientIp(req),
      });
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (event.status === "paid") {
      const validation = validatePaymentForOrder(order, {
        orderNumber,
        transactionId,
        amount: event.amount,
        currency: event.currency,
        status: "paid",
        paid: true,
      });

      if (!validation.ok) {
        logPaymentValidationFailure("webhook", validation);
        return NextResponse.json({ error: validation.message }, { status: 400 });
      }

      if (order.status !== "PENDING") {
        if (["PAID", "PROCESSING", "DELIVERED"].includes(order.status)) {
          return NextResponse.json({ ok: true, skipped: true, reason: "already_paid" });
        }

        return NextResponse.json(
          { error: "Order is not pending and cannot be marked paid" },
          { status: 409 }
        );
      }

      let fullOrder = null;
      try {
        fullOrder = await prisma.$transaction(async (tx: any) => {
          await tx.processedWebhookEvent.create({
            data: {
              transactionId: validation.transactionId,
              orderNumber: order.orderNumber,
              processedAt: new Date(),
            },
          });

          const updated = await tx.order.updateMany({
            where: {
              id: order.id,
              status: "PENDING",
              paymentRef: validation.transactionId,
            },
            data: {
              status: "PAID",
              paidAt: new Date(),
            },
          });

          if (updated.count !== 1) {
            throw new Error("Order payment update lost a race or no longer matches paymentRef.");
          }

          return tx.order.findUnique({
            where: { id: order.id },
            include: { game: true, product: true },
          });
        });
      } catch (error) {
        if (isPrismaUniqueError(error)) {
          logSecurityEvent({
            event: "webhook_replay_blocked",
            detail: `transactionId=${validation.transactionId}; order=${order.orderNumber}`,
          });
          return NextResponse.json({ ok: true, skipped: true, reason: "replay" });
        }
        throw error;
      }

      if (fullOrder) {
        await notifyAndMaybeDeliverPaidOrder(fullOrder.id);
      }
    } else {
      if (!order.paymentRef || order.paymentRef !== transactionId) {
        logSecurityEvent({
          event: "payment_transaction_mismatch",
          detail: `webhook ${event.status}: got=${transactionId}; expected=${order.paymentRef || "missing"}; order=${order.orderNumber}`,
        });
        return NextResponse.json(
          { error: "Payment transaction does not match order" },
          { status: 400 }
        );
      }

      if (order.status === "PENDING") {
        try {
          await prisma.$transaction(async (tx: any) => {
            await tx.processedWebhookEvent.create({
              data: {
                transactionId,
                orderNumber: order.orderNumber,
                processedAt: new Date(),
              },
            });

            await tx.order.update({
              where: { id: order.id },
              data: {
                status: event.status === "expired" ? "CANCELLED" : "FAILED",
                failureReason: `Tola Saint: ${event.status}`,
              },
            });
          });
        } catch (error) {
          if (isPrismaUniqueError(error)) {
            return NextResponse.json({ ok: true, skipped: true, reason: "replay" });
          }
          throw error;
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
