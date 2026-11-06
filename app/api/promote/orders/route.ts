import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/affiliate/session";
import { getAffiliateOrders } from "@/lib/affiliate/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const creator = await getCurrentCreator();
  if (!creator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status")?.toUpperCase();
  let orders = getAffiliateOrders(creator.id);

  if (status && status !== "ALL") {
    orders = orders.filter((o) => o.status === status);
  }

  return NextResponse.json(orders);
}

