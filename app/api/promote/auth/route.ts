import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  authenticateAffiliate,
  registerAffiliate,
  getAffiliateStats,
  getAffiliateNotifications,
  markNotificationsAsRead,
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

    // ── 1. Login ──────────────────────────────────────────────
    if (action === "login") {
      const { identifier, password } = body;
      if (!identifier || !password) {
        return NextResponse.json(
          { success: false, error: "Please provide username/email and password" },
          { status: 400 }
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
