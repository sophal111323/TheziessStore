import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";
import {
  getAllAffiliates,
  getAffiliateStats,
  updateAffiliateStatus,
  getAffiliateSettings,
  updateAffiliateSettings,
  clearAffiliateBalance,
  recordAffiliateAdjustment,
  updateAffiliatePayoutStatus,
} from "@/lib/affiliate/store";

export const dynamic = "force-dynamic";

export const GET = withAdminAuth(
  async (req: NextRequest) => {
    const affiliates = getAllAffiliates();
    const settings = getAffiliateSettings();
    const listWithStats = affiliates.map((a) => {
      const stats = getAffiliateStats(a.id);
      return {
        ...a,
        stats,
      };
    });

    return NextResponse.json({
      promoters: listWithStats,
      settings,
    });
  },
  { permission: "games.read" }
);

export const PATCH = withAdminAuth(
  async (req: NextRequest, _ctx, admin) => {
    const body = await req.json().catch(() => ({}));

    // ── 1. Clear Balance / Payout ────────────────────────────
    if (body.action === "clear_balance") {
      const { affiliateId, amountUsd, paymentMethod, accountName, accountNumber, note } = body;
      if (!affiliateId) {
        return NextResponse.json({ error: "Affiliate ID is required" }, { status: 400 });
      }

      const res = clearAffiliateBalance({
        affiliateId,
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

      const stats = getAffiliateStats(affiliateId);
      return NextResponse.json({ success: true, payout: res.payout, stats });
    }

    // ── 2. Add or Deduct Balance (Adjust Balance) ────────────
    if (body.action === "adjust_balance") {
      const { affiliateId, type, amountUsd, reason } = body;
      if (!affiliateId) {
        return NextResponse.json({ error: "Affiliate ID is required" }, { status: 400 });
      }
      if (type !== "ADD" && type !== "DEDUCT") {
        return NextResponse.json({ error: "Type must be ADD or DEDUCT" }, { status: 400 });
      }

      const res = recordAffiliateAdjustment({
        affiliateId,
        type,
        amountUsd: Number(amountUsd),
        reason,
        adminEmail: (admin as any)?.email,
      });

      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }

      const stats = getAffiliateStats(affiliateId);
      return NextResponse.json({ success: true, adjustment: res.adjustment, stats });
    }

    // ── 3. Update Payout Status (Approve / Reject) ───────────
    if (body.action === "update_payout_status") {
      const { payoutId, status, note } = body;
      if (!payoutId || !["PENDING", "APPROVED", "PAID", "REJECTED"].includes(status)) {
        return NextResponse.json({ error: "Invalid payout ID or status" }, { status: 400 });
      }

      const updated = updateAffiliatePayoutStatus(payoutId, status, note);
      if (!updated) {
        return NextResponse.json({ error: "Payout not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, payout: updated });
    }

    // ── 4. Update Registration & Quota Settings ─────────────
    if (body.action === "update_settings") {
      const { registrationOpen, maxPromoters, closedMessageKh, closedMessageEn } = body;
      const updatedSettings = updateAffiliateSettings({
        registrationOpen: typeof registrationOpen === "boolean" ? registrationOpen : undefined,
        maxPromoters: typeof maxPromoters === "number" ? Math.max(1, Math.floor(maxPromoters)) : undefined,
        closedMessageKh: typeof closedMessageKh === "string" ? closedMessageKh : undefined,
        closedMessageEn: typeof closedMessageEn === "string" ? closedMessageEn : undefined,
      });

      return NextResponse.json({ success: true, settings: updatedSettings });
    }

    // ── 5. Update Promoter Status ───────────────────────────
    const { affiliateId, status } = body;

    if (!affiliateId || (status !== "ACTIVE" && status !== "SUSPENDED")) {
      return NextResponse.json({ error: "Invalid status or affiliate ID" }, { status: 400 });
    }

    const updated = updateAffiliateStatus(affiliateId, status);
    if (!updated) {
      return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, affiliate: updated });
  },
  { permission: "games.write" }
);

