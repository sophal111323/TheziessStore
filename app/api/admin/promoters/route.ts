import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";
import {
  getAllAffiliates,
  getAffiliateStats,
  updateAffiliateStatus,
} from "@/lib/affiliate/store";

export const dynamic = "force-dynamic";

export const GET = withAdminAuth(
  async (req: NextRequest) => {
    const affiliates = getAllAffiliates();
    const listWithStats = affiliates.map((a) => {
      const stats = getAffiliateStats(a.id);
      return {
        ...a,
        stats,
      };
    });

    return NextResponse.json({ promoters: listWithStats });
  },
  { permission: "games.read" }
);

export const PATCH = withAdminAuth(
  async (req: NextRequest) => {
    const body = await req.json().catch(() => ({}));
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
