import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";
import {
  getAffiliateById,
  getAffiliateBySlug,
  getAffiliateStats,
  getAffiliateOrders,
  getAffiliatePayouts,
  getAffiliateAdjustments,
  clearAffiliateBalance,
  recordAffiliateAdjustment,
  updateAffiliateStatus,
} from "@/lib/affiliate/store";

export const dynamic = "force-dynamic";

export const GET = withAdminAuth(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const affiliate = getAffiliateById(id) || getAffiliateBySlug(id);

    if (!affiliate) {
      return NextResponse.json({ error: "Promoter not found" }, { status: 404 });
    }

    const stats = getAffiliateStats(affiliate.id);
    const orders = getAffiliateOrders(affiliate.id);
    const payouts = getAffiliatePayouts(affiliate.id);
    const adjustments = getAffiliateAdjustments(affiliate.id);

    return NextResponse.json({
      affiliate,
      stats,
      orders,
      payouts,
      adjustments,
    });
  },
  { permission: "games.read" }
);

export const PATCH = withAdminAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, admin) => {
    const { id } = await params;
    const affiliate = getAffiliateById(id) || getAffiliateBySlug(id);
    if (!affiliate) {
      return NextResponse.json({ error: "Promoter not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));

    // ── 1. Clear Balance / Payout ────────────────────────────
    if (body.action === "clear_balance") {
      const { amountUsd, paymentMethod, accountName, accountNumber, note } = body;
      const res = clearAffiliateBalance({
        affiliateId: affiliate.id,
        amountUsd: typeof amountUsd === "number" ? amountUsd : undefined,
        paymentMethod,
        accountName,
        accountNumber,
        note,
        adminEmail: (admin as any)?.email,
      });

      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }

      const stats = getAffiliateStats(affiliate.id);
      return NextResponse.json({ success: true, payout: res.payout, stats });
    }

    // ── 2. Add or Deduct Balance (Adjust Balance) ────────────
    if (body.action === "adjust_balance") {
      const { type, amountUsd, reason } = body;
      if (type !== "ADD" && type !== "DEDUCT") {
        return NextResponse.json({ error: "Type must be ADD or DEDUCT" }, { status: 400 });
      }

      const res = recordAffiliateAdjustment({
        affiliateId: affiliate.id,
        type,
        amountUsd: Number(amountUsd),
        reason,
        adminEmail: (admin as any)?.email,
      });

      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }

      const stats = getAffiliateStats(affiliate.id);
      return NextResponse.json({ success: true, adjustment: res.adjustment, stats });
    }

    // ── 3. Toggle Status ────────────────────────────────────
    if (body.status === "ACTIVE" || body.status === "SUSPENDED") {
      const updated = updateAffiliateStatus(affiliate.id, body.status);
      return NextResponse.json({ success: true, affiliate: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  },
  { permission: "games.write" }
);

