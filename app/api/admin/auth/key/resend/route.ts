import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getIp";
import { applyRateLimit } from "@/lib/rateLimit";
import { adminApiErrorResponse } from "@/lib/adminApiError";
import {
  ADMIN_KEY_PENDING_COOKIE,
  generate264Key,
  hashKey,
  signTelegramKeyToken,
  sendTelegramKeyMessage,
  verifyTelegramKeyToken,
  TELEGRAM_KEY_TTL_SECONDS,
} from "@/lib/adminTelegramKey";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    // Rate limit resends: 5 per 15 minutes per IP
    const rl = await applyRateLimit(`admin-key-resend:${ip}`, 5, 15 * 60 * 1000, ip);
    if (rl) return rl;

    const token = req.cookies.get(ADMIN_KEY_PENDING_COOKIE)?.value;
    if (!token) {
      return NextResponse.json(
        { error: "វគ្គ Login បានផុតកំណត់។ សូមត្រឡប់ទៅ Login ម្តងទៀត។" },
        { status: 401 }
      );
    }

    const payload = verifyTelegramKeyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: "វគ្គ Login បានផុតកំណត់។ សូមត្រឡប់ទៅ Login ម្តងទៀត។" },
        { status: 401 }
      );
    }

    const admin = await prisma.admin.findUnique({ where: { id: payload.adminId } });
    if (!admin || !admin.active) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate fresh 264 key
    const rawKey = generate264Key();
    const keyHash = hashKey(rawKey);

    const pendingKeyToken = signTelegramKeyToken({
      adminId: payload.adminId,
      email: payload.email,
      keyHash,
    });

    await sendTelegramKeyMessage(payload.email, rawKey);

    const res = NextResponse.json({
      ok: true,
      message: "បានបង្កើត និងផ្ញើ Key ថ្មី 264 តួអក្សរទៅកាន់ Telegram Bot រួចរាល់ហើយ!",
    });

    res.cookies.set(ADMIN_KEY_PENDING_COOKIE, pendingKeyToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: TELEGRAM_KEY_TTL_SECONDS,
    });

    return res;
  } catch (err) {
    console.error("Admin key resend error:", err);
    return adminApiErrorResponse(err);
  }
}

