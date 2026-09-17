import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getClientIp } from "@/lib/getIp";
import { checkRateLimitDb, checkRateLimitMemory } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/secureLogger";
import {
  authenticateAffiliate,
  registerAffiliate,
  getAffiliateStats,
  getAffiliateNotifications,
  markNotificationsAsRead,
  getAffiliateSettings,
  getAllAffiliates,
} from "@/lib/affiliate/store";
import { CREATOR_COOKIE_NAME, getCurrentCreator } from "@/lib/affiliate/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const creator = await getCurrentCreator();
  if (!creator) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const stats = getAffiliateStats(creator.id);
  const notifications = getAffiliateNotifications(creator.id);

  return NextResponse.json({
    authenticated: true,
    creator,
    stats,
    notifications,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const ip = getClientIp(req);

    // ── 1. Login ──────────────────────────────────────────────
    if (action === "login") {
      const { identifier, password } = body;
      if (!identifier || !password) {
        return NextResponse.json(
          { success: false, error: "Please provide username/email and password" },
          { status: 400 }
        );
      }

      // Fast in-memory flood protection (max 20 requests per minute)
      const isBurstAllowed = checkRateLimitMemory(`promote-login-flood:${ip}`, 20, 60 * 1000);
      if (!isBurstAllowed) {
        logSecurityEvent({
          event: "rate_limit_exceeded",
          detail: `promote_login_burst_flood: identifier=${identifier}`,
          ip,
        });
        return NextResponse.json(
          {
            success: false,
            error: "Too many login attempts. Please slow down and wait a minute.",
            retryAfter: 60,
          },
          {
            status: 429,
            headers: {
              "Retry-After": "60",
              "Cache-Control": "no-store",
            },
          }
        );
      }

      // Persistent IP Rate Limit (max 10 login attempts per 15 minutes)
      const isIpAllowed = await checkRateLimitDb(`promote-login-ip:${ip}`, 10, 15 * 60 * 1000, ip);
      if (!isIpAllowed) {
        logSecurityEvent({
          event: "rate_limit_exceeded",
          detail: `promote_login_ip_limit: ip=${ip}, identifier=${identifier}`,
          ip,
        });
        return NextResponse.json(
          {
            success: false,
            error: "Too many login attempts from this network. Please try again in 15 minutes.",
            retryAfter: 900,
          },
          {
            status: 429,
            headers: {
              "Retry-After": "900",
              "Cache-Control": "no-store",
            },
          }
        );
      }

      // Per-Account Brute Force Defense (max 5 attempts per 15 minutes per username/email)
      const normIdentifier = String(identifier).toLowerCase().trim();
      const isTargetAllowed = await checkRateLimitDb(`promote-login-target:${normIdentifier}`, 5, 15 * 60 * 1000, ip);
      if (!isTargetAllowed) {
        logSecurityEvent({
          event: "rate_limit_exceeded",
          detail: `promote_login_target_limit: target=${normIdentifier}`,
          ip,
        });
        return NextResponse.json(
          {
            success: false,
            error: "Too many failed attempts for this account. Please wait 15 minutes before trying again.",
            retryAfter: 900,
          },
          {
            status: 429,
            headers: {
              "Retry-After": "900",
              "Cache-Control": "no-store",
            },
          }
        );
      }

      const affiliate = authenticateAffiliate(identifier, password);
      if (!affiliate) {
        return NextResponse.json(
          { success: false, error: "Invalid username/email or password" },
          { status: 401 }
        );
      }

      if (affiliate.status === "SUSPENDED") {
        return NextResponse.json(
          { success: false, error: "Your creator account has been suspended. Please contact admin." },
          { status: 403 }
        );
      }

      const res = NextResponse.json({
        success: true,
        creator: affiliate,
      });

      res.cookies.set(CREATOR_COOKIE_NAME, affiliate.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      return res;
    }

    // ── 2. Register ───────────────────────────────────────────
    if (action === "register") {
      const settings = getAffiliateSettings();
      const currentAffiliates = getAllAffiliates();

      // Check if admin closed registration
      if (!settings.registrationOpen) {
        return NextResponse.json(
          {
            success: false,
            error: settings.closedMessageKh || "ការចុះឈ្មោះជា Promoter ត្រូវបានបិទបណ្ដោះអាសន្ន។",
          },
          { status: 403 }
        );
      }

      // Check if registration limit / quota is reached
      if (currentAffiliates.length >= settings.maxPromoters) {
        return NextResponse.json(
          {
            success: false,
            error: `កម្មវិធី Promoter បានពេញកូតាកំណត់ចំនួន ${settings.maxPromoters} នាក់រួចរាល់ហើយ (${currentAffiliates.length}/${settings.maxPromoters})។ សូមរង់ចាំជុំបន្ទាប់!`,
          },
          { status: 403 }
        );
      }

      // Limit registration to max 5 accounts per hour per IP
      const isRegAllowed = await checkRateLimitDb(`promote-register-ip:${ip}`, 5, 60 * 60 * 1000, ip);
      if (!isRegAllowed) {
        logSecurityEvent({
          event: "rate_limit_exceeded",
          detail: `promote_register_ip_limit: ip=${ip}`,
          ip,
        });
        return NextResponse.json(
          { success: false, error: "Too many accounts registered from this device. Please try again later.", retryAfter: 3600 },
          { status: 429, headers: { "Retry-After": "3600", "Cache-Control": "no-store" } }
        );
      }

      const { name, username, email, phone, telegram, facebook, tiktok, youtube, password, confirmPassword, agree } = body;

      if (!agree) {
        return NextResponse.json(
          { success: false, error: "You must agree to the Creator Program Terms" },
          { status: 400 }
        );
      }

      if (!name?.trim() || !username?.trim() || !email?.trim() || !password) {
        return NextResponse.json(
          { success: false, error: "All required fields must be filled" },
          { status: 400 }
        );
      }

      if (password.length < 6) {
        return NextResponse.json(
          { success: false, error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }

      if (password !== confirmPassword) {
        return NextResponse.json(
          { success: false, error: "Passwords do not match" },
          { status: 400 }
        );
      }

      const result = registerAffiliate({
        name,
        username,
        email,
        phone,
        telegram,
        facebook,
        tiktok,
        youtube,
        password,
      });

      if (!result.success || !result.affiliate) {
        return NextResponse.json(
          { success: false, error: result.error || "Registration failed" },
          { status: 400 }
        );
      }

      const res = NextResponse.json({
        success: true,
        creator: result.affiliate,
      });

      res.cookies.set(CREATOR_COOKIE_NAME, result.affiliate.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });

      return res;
    }

    // ── 3. Logout ─────────────────────────────────────────────
    if (action === "logout") {
      const res = NextResponse.json({ success: true });
      res.cookies.delete(CREATOR_COOKIE_NAME);
      return res;
    }

    // ── 4. Mark notifications read ────────────────────────────
    if (action === "read_notifications") {
      const creator = await getCurrentCreator();
      if (creator) {
        markNotificationsAsRead(creator.id);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Server error" }, { status: 500 });
  }
}
