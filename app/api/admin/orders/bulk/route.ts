import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { writeAuditForAdmin } from "@/lib/audit";
import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";

export const DELETE = withAdminAuth(
  async (req, _ctx, admin) => {
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== "DELETE") {
      return NextResponse.json(
        { error: "Missing confirmation. Resend with { confirm: 'DELETE' }." },
        { status: 400 }
      );
    }

    const status = typeof body.status === "string" ? body.status : "ALL";
    const where = status === "ALL" ? undefined : { status: status === "COMPLETED" ? "DELIVERED" : status };

    const result = await prisma.order.deleteMany({ where });

    await writeAuditForAdmin(admin, req, {
      action: "orders.bulk_delete",
      targetType: "order",
      details: `Deleted ${result.count} orders (filter: ${status})`,
    });

    return NextResponse.json({ ok: true, deleted: result.count });
  },
  { roles: ["OWNER"] }
);

import { fulfillPaidOrder } from "@/lib/fulfillment";
import { revalidateAdminChange } from "@/lib/adminRevalidate";

export const POST = withAdminAuth(
  async (req, _ctx, admin) => {
    const body = await req.json().catch(() => ({}));
    let targetOrderNumbers: string[] = [];

    if (Array.isArray(body.orderNumbers) && body.orderNumbers.length > 0) {
      targetOrderNumbers = body.orderNumbers.map((n: string) => String(n).toUpperCase());
    } else if (body.allPaid) {
      const paidOrders = await prisma.order.findMany({
        where: { status: "PAID" },
        select: { orderNumber: true },
        take: 50,
      });
      targetOrderNumbers = paidOrders.map((o) => o.orderNumber);
    } else {
      return NextResponse.json(
        { error: "Provide orderNumbers array or set allPaid: true" },
        { status: 400 }
      );
    }

    const results: Array<{ orderNumber: string; success: boolean; status?: string; error?: string; transactionId?: string }> = [];
    let succeeded = 0;
    let failed = 0;

    for (const orderNum of targetOrderNumbers) {
      try {
        const res = await fulfillPaidOrder(orderNum, { force: Boolean(body.force) });
        if (res.success) succeeded++;
        else failed++;
        results.push({ orderNumber: orderNum, ...res });
      } catch (err: any) {
        failed++;
        results.push({ orderNumber: orderNum, success: false, error: err?.message || "Unknown error" });
      }
    }

    await writeAuditForAdmin(admin, req, {
      action: "orders.bulk_retry_api",
      targetType: "order",
      details: `Bulk fulfillment for ${targetOrderNumbers.length} orders: ${succeeded} succeeded, ${failed} failed`,
    });

    revalidateAdminChange("orders");

    return NextResponse.json({
      ok: true,
      total: targetOrderNumbers.length,
      succeeded,
      failed,
      results,
    });
  },
  { permission: "orders.update" }
);
