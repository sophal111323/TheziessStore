import { NextRequest, NextResponse } from "next/server";
import { sweepProcessingOrders, sweepPendingOrders } from "@/lib/order-tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-cron-secret") || "";

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [processingResult, pendingResult] = await Promise.all([
      sweepProcessingOrders(),
      sweepPendingOrders(),
    ]);

    return NextResponse.json({
      ok: true,
      processing: processingResult,
      pending: pendingResult,
    });
  } catch (error) {
    console.error("[cron/check-processing-orders] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

