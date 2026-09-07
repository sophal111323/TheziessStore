import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getIp";
import { applyRateLimit } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/secureLogger";
import { writeAuditForAdmin } from "@/lib/audit";
import { adminApiErrorResponse } from "@/lib/adminApiError";
import { getLockDurationMs, formatLockDuration } from "@/lib/lockPolicy";
import { ADMIN_COOKIE_NAME, signAdminToken } from "@/lib/auth";
import {
  ADMIN_KEY_PENDING_COOKIE,
  hashKey,
  verifyTelegramKeyToken,
  sendTelegramKeyMessage,
  verifyAndConsumeTelegramBotKey,
  TELEGRAM_KEY_LENGTH,
} from "@/lib/adminTelegramKey";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const keySchema = z.object({
  key: z.string().min(10, "Key ត្រូវតែមានប្រវែងយ៉ាងតិច 264 តួអក្សរ"),
});

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(ADMIN_KEY_PENDING_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ step: "none" }, { headers: { "Cache-Control": "no-store" } });
    }

    const payload = verifyTelegramKeyToken(token);
    if (!payload) {
      return NextResponse.json({ step: "none" }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json(
      {
        step: "key",
        email: payload.email,
        expectedLength: TELEGRAM_KEY_LENGTH,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return adminApiErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  try {
    const rl = await applyRateLimit(`admin-key-verify:${ip}`, 10, 15 * 60 * 1000, ip);
    if (rl) return rl;

    const token = req.cookies.get(ADMIN_KEY_PENDING_COOKIE)?.value;
    if (!token) {
      return NextResponse.json(
        { error: "Security Key បានផុតកំណត់ ឬមិនត្រឹមត្រូវ។ សូម Login ម្តងទៀត។" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const payload = verifyTelegramKeyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: "Security Key បានផុតកំណត់ (លើស 5 នាទី)។ សូមផ្ញើ Key ឡើងវិញ ឬ Login ម្តងទៀត។" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const lockIdentifier = `admin-key:${payload.email.toLowerCase().trim()}`;
    const lock = await prisma.adminAuthLock.findUnique({
      where: { identifier: lockIdentifier },
    });

    if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
      const remainingMs = lock.lockedUntil.getTime() - Date.now();
      return NextResponse.json(
        {
          error: `កូដ Key ខុសច្រើនដង។ គណនីត្រូវ lock។ សូមរង់ចាំ ${formatLockDuration(remainingMs)}។`,
          lockedUntil: lock.lockedUntil,
          retryAfter: formatLockDuration(remainingMs),
          attemptsRemaining: 0,
        },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = keySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "សូមបញ្ចូល Security Key 264 តួអក្សរដែលបានផ្ញើទៅ Telegram។" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const inputKey = parsed.data.key.trim();
    const inputHash = hashKey(inputKey);

    const bufferA = Buffer.from(inputHash, "utf8");
    const bufferB = Buffer.from(payload.keyHash, "utf8");

    const matchesCookie = bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
    const matchesBotKey = !matchesCookie ? await verifyAndConsumeTelegramBotKey(inputKey) : false;
    const isValid = matchesCookie || matchesBotKey;

    const admin = await prisma.admin.findUnique({ where: { id: payload.adminId } });
    if (!admin || !admin.active) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isValid) {
      const nextFail = (lock?.failCount ?? 0) + 1;
      const durationMs = getLockDurationMs(nextFail);
      const isLocked = durationMs > 0;
      const lockedUntil = isLocked ? new Date(Date.now() + durationMs) : null;

      await prisma.adminAuthLock.upsert({
        where: { identifier: lockIdentifier },
        update: { failCount: nextFail, lockedUntil, forever: false },
        create: { identifier: lockIdentifier, failCount: nextFail, lockedUntil, forever: false },
      });

      logSecurityEvent({
        event: "admin_telegram_key_fail",
        adminId: payload.adminId,
        ip,
        failCount: nextFail,
        detail: `Input length: ${inputKey.length}`,
      });

      if (isLocked && lockedUntil) {
        const remainingMs = lockedUntil.getTime() - Date.now();
        return NextResponse.json(
          {
            error: `Security Key មិនត្រឹមត្រូវ។ គណនីត្រូវ lock រយៈពេល ${formatLockDuration(remainingMs)}។`,
            lockedUntil,
            retryAfter: formatLockDuration(remainingMs),
            attemptsRemaining: 0,
          },
          { status: 429, headers: { "Cache-Control": "no-store" } }
        );
      }

      const remainingAttempts = Math.max(0, 3 - nextFail);
      return NextResponse.json(
        {
          error: `Security Key មិនត្រឹមត្រូវទេ។ (នៅសល់ ${remainingAttempts} លើកទៀត មុនពេល lock)`,
          attemptsRemaining: remainingAttempts,
        },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ✅ Key verified successfully — clear lock
    await prisma.adminAuthLock.deleteMany({ where: { identifier: lockIdentifier } });

    await prisma.admin.update({
      where: { id: payload.adminId },
      data: { lastLoginAt: new Date() },
    });

    logSecurityEvent({
      event: "admin_telegram_key_success",
      adminId: payload.adminId,
      ip,
    });

    await writeAuditForAdmin(admin, req, {
      action: "admin_web_login_key_verified",
      targetType: "Admin",
      targetId: admin.id,
      details: { ip },
    });

    const adminToken = signAdminToken(payload.adminId);
    const isProduction = process.env.NODE_ENV === "production";

    const res = NextResponse.json({
      ok: true,
      email: payload.email,
      message: "ចូលប្រព័ន្ធបានជោគជ័យ!",
    });

    res.cookies.set(ADMIN_COOKIE_NAME, adminToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    // Clear pending key cookie
    res.cookies.set(ADMIN_KEY_PENDING_COOKIE, "", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (err) {
    console.error("Admin key verification error:", err);
    return adminApiErrorResponse(err);
  }
}

