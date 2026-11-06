import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqualString } from "@/lib/secretCompare";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint for required secrets.
 *
 * Public response: `{ ok }` only — status 500 when NODE_ENV===production and
 * any required secret is missing, else 200. Secret names (missing/warnings)
 * are included only for `Authorization: Bearer <CRON_SECRET>` callers, so
 * anonymous visitors learn nothing about the configuration.
 */
export async function GET(req: NextRequest) {
  const isProduction = process.env.NODE_ENV === "production";

  const requiredSecrets = [
    { name: "ADMIN_JWT_SECRET", value: process.env.ADMIN_JWT_SECRET },
    { name: "FROZENYUKI_WEBHOOK_SECRET", value: process.env.FROZENYUKI_WEBHOOK_SECRET },
    { name: "CRON_SECRET", value: process.env.CRON_SECRET },
  ];

  const isSet = (value: string | undefined) => !!value && value.trim() !== "";

  const missingSecrets = requiredSecrets
    .filter(secret => !isSet(secret.value))
    .map(secret => secret.name);

  // ORDER_LOOKUP_SECRET signs customer order tokens (lib/orderToken.ts). It is
  // satisfied by itself or by the ADMIN_JWT_SECRET fallback.
  const warnings: string[] = [];
  const hasOrderLookupSecret = isSet(process.env.ORDER_LOOKUP_SECRET);
  if (!hasOrderLookupSecret) {
    if (isSet(process.env.ADMIN_JWT_SECRET)) {
      warnings.push(
        "ORDER_LOOKUP_SECRET is not set; order tokens fall back to ADMIN_JWT_SECRET. Set a dedicated ORDER_LOOKUP_SECRET."
      );
    } else {
      missingSecrets.push("ORDER_LOOKUP_SECRET");
    }
  }

  // Non-fatal hardening settings (ATK-06 / ATK-12).
  if (isProduction) {
    if (!isSet(process.env.ADMIN_LOGIN_PATH)) {
      warnings.push(
        "ADMIN_LOGIN_PATH is not set; the admin login uses the default path from the public source. Set a long random path."
      );
    }
    if (!isSet(process.env.ORIGIN_SHARED_SECRET)) {
      warnings.push(
        "ORIGIN_SHARED_SECRET is not set; the origin accepts traffic that bypasses Cloudflare. See DEPLOY.md (origin lock)."
      );
    }
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  const isAuthorized =
    !!cronSecret &&
    timingSafeEqualString(req.headers.get("authorization"), `Bearer ${cronSecret}`);

  const ok = !(isProduction && missingSecrets.length > 0);
  const headers = { "Cache-Control": "no-store" };

  if (!isAuthorized) {
    return NextResponse.json({ ok }, { status: ok ? 200 : 500, headers });
  }

  return NextResponse.json(
    {
      ok,
      ...(ok
        ? {
            message: isProduction
              ? "All required secrets are configured"
              : "Health check passed (non-production mode)",
          }
        : { error: "Missing required secrets in production" }),
      ...(missingSecrets.length > 0 ? { missing: missingSecrets } : {}),
      ...(warnings.length > 0 ? { warnings } : {}),
    },
    { status: ok ? 200 : 500, headers }
  );
}
