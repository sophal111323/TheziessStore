import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/withAdminAuth";
import {
  getAffiliateById,
  getAffiliateBySlug,
  getAffiliateStats,
  getAffiliateOrders,
  getAffiliatePayouts,
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

    return NextResponse.json({
      affiliate,
      stats,
      orders,
      payouts,
    });
  },
  { permission: "games.read" }
);

