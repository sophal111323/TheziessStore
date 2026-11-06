import { NextRequest } from "next/server";
import { POST as handleWebhook } from "./[method]/route";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handleWebhook(req, {
    params: Promise.resolve({ method: "tolasaint" }),
  });
}

