// app/api/payments/webhook/[method]/route.ts
//
// Alias route for /api/payment/webhook/[method] to ensure both singular
// and plural paths work seamlessly with all payment providers.

import { NextRequest } from "next/server";
import { POST as handlePaymentWebhook } from "@/app/api/payment/webhook/[method]/route";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ method: string }> }
) {
  return handlePaymentWebhook(req, context);
}
