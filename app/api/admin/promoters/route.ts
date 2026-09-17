import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";
import {
  getAllAffiliates,
  getAffiliateStats,
  updateAffiliateStatus,
  getAffiliateSettings,
  updateAffiliateSettings,
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
  async (req: NextRequest) => {
    const body = await req.json().catch(() => ({}));

    // ── 1. Update Registration & Quota Settings ─────────────
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

    // ── 2. Update Promoter Status ───────────────────────────
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

