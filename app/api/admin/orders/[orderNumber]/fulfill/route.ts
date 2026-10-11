import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { fulfillPaidOrder } from "@/lib/fulfillment";
import { writeAuditForAdmin } from "@/lib/audit";
import { revalidateAdminChange } from "@/lib/adminRevalidate";
import { normalizeAdminRole } from "@/lib/adminPermissions";
import { fulfillNeedsOwnerOverride } from "@/lib/manualOrderOverride";
import { logSecurityEvent } from "@/lib/secureLogger";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export const POST = withAdminAuth(
  async (req, { params }: { params: Promise<{ orderNumber: string }> }, admin) => {
    const { orderNumber } = await params;
    const normalizedOrderNumber = orderNumber.toUpperCase();
    const body = await req.json().catch(() => ({}));
    const force = Boolean(body?.force);

    const order = await prisma.order.findUnique({
      where: { orderNumber: normalizedOrderNumber },
      select: { status: true, paidAt: true, deliveredAt: true, amountUsd: true },
    });
    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    // ── Security (R-2): topping up an unpaid or already delivered order is a
    // manual payment override: OWNER + confirmManualPaid, always alerted.
    const manualOverride = fulfillNeedsOwnerOverride(order, force);
    if (manualOverride) {
      if (normalizeAdminRole(admin.role) !== "OWNER") {
        return NextResponse.json(
          { success: false, error: "Only the site owner can top up an unpaid or already delivered order." },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
      if (body?.confirmManualPaid !== true) {
        return NextResponse.json(
          { success: false, error: "Topping up an unpaid or already delivered order requires confirmManualPaid:true." },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }

      logSecurityEvent({
        event: "admin_settings_changed",
        adminId: admin.id,
        detail: `Manual top-up override: order=${normalizedOrderNumber}, status=${order.status}, amount=$${order.amountUsd}`,
      });
      await notifyTelegram(
        `⚠️ <b>MANUAL TOP-UP OVERRIDE (${escapeHtml(order.status)})</b>\n` +
          `#${escapeHtml(normalizedOrderNumber)} — $${order.amountUsd.toFixed(2)}\n` +
          `Admin: ${escapeHtml(admin.email)}`
      );
    }

    const result = await fulfillPaidOrder(normalizedOrderNumber, { force, manualOverride });

    await writeAuditForAdmin(admin, req, {
      action: manualOverride ? "order.manual_override_topup" : "order.retry_auto_topup",
      targetType: "order",
      targetId: normalizedOrderNumber,
      details: manualOverride
        ? { manualOverride: true, from: order.status, amountUsd: order.amountUsd, result }
        : result,
    });

    revalidateAdminChange("orders", { orderNumber: normalizedOrderNumber });

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  },
  { permission: "orders.update" }
);
