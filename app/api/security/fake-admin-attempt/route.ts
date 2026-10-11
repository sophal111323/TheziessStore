import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/getIp";

export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;
const MAX_LOGGED_KEYS = 10;
const MAX_KEY_LENGTH = 50;

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitRecord>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = `fake-admin:${ip}`;
  const record = rateLimitStore.get(key);

  if (!record || record.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });

    return true;
  }

  if (record.count >= MAX_ATTEMPTS) {
    return false;
  }

  record.count += 1;
  rateLimitStore.set(key, record);

  return true;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many attempts" },
      { status: 429 }
    );
  }

  // Never log submitted values (attacker-typed passwords, log flooding):
  // only the body's key names (max 10) and its JSON length.
  const rawBody = await req.text().catch(() => "");
  let bodyKeys: string[] = [];

  try {
    const parsed: unknown = rawBody ? JSON.parse(rawBody) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      bodyKeys = Object.keys(parsed)
        .slice(0, MAX_LOGGED_KEYS)
        .map((k) => k.slice(0, MAX_KEY_LENGTH));
    }
  } catch {
    bodyKeys = [];
  }

  const userAgent = req.headers.get("user-agent") || "unknown";
  const referer = req.headers.get("referer") || "unknown";

  console.warn("[SECURITY] Fake admin login attempt", {
    ip,
    userAgent,
    referer,
    bodyKeys,
    bodyLength: rawBody.length,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
