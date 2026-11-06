import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/affiliate/session";
import { getAffiliatePayouts, requestPayout, getAffiliateStats } from "@/lib/affiliate/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const creator = await getCurrentCreator();
  if (!creator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payouts = getAffiliatePayouts(creator.id);
  const stats = getAffiliateStats(creator.id);

  return NextResponse.json({
    payouts,
    availableBalance: stats.availableBalance,
    paidCommission: stats.paidCommission,
    pendingCommission: stats.pendingCommission,
  });
}

export async function POST(req: NextRequest) {
  const creator = await getCurrentCreator();
  if (!creator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { amountUsd, paymentMethod, accountName, accountNumber, note } = body;

    const parsedAmount = Number(amountUsd);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (!paymentMethod || !accountName || !accountNumber) {
      return NextResponse.json({ error: "Payment method, account name, and account number are required" }, { status: 400 });
    }

    const res = requestPayout(creator.id, {
      amountUsd: parsedAmount,
      paymentMethod,
      accountName,
      accountNumber,
      note,
    });

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, payout: res.payout });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to submit payout" }, { status: 500 });
  }
}

