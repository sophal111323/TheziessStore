/**
 * lib/auth.ts — Admin authentication helpers
 *
 * Web admin continues to use the HttpOnly admin_token cookie.
 * Flutter/mobile admin can use a Bearer token verified from AdminSession.
 */

import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { getAdminFromBearerToken, isAllowedAdminRole } from "@/lib/adminMobileAuth";
import { ADMIN_SESSION_TOKEN_TYPE, isAdminSessionClaims } from "@/lib/adminSessionClaims";

const ADMIN_COOKIE_NAME = "admin_token";

// Reduced from 7 days to 8 hours (Issue #7)
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function getAdminJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error("ADMIN_JWT_SECRET is not set");
  }
  return secret;
}

export function signAdminToken(adminId: string) {
  return jwt.sign({ adminId, typ: ADMIN_SESSION_TOKEN_TYPE }, getAdminJwtSecret(), {
    algorithm: "HS256",
    expiresIn: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Verifies a full admin session JWT. HS256 is pinned and the typed claims are
 * required, so pending-2FA / Telegram-key / lock-hint tokens and any other
 * JWT signed with the same secret are rejected (ATK-02).
 */
export function verifyAdminToken(token: string) {
  try {
    const payload = jwt.verify(token, getAdminJwtSecret(), {
      algorithms: ["HS256"],
    });
    if (!isAdminSessionClaims(payload)) return null;
    return payload as {
      adminId: string;
      typ: string;
      iat: number;
      exp: number;
    };
  } catch {
    return null;
  }
}

export function buildAuthCookie(token: string) {
  return [
    `${ADMIN_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    "Secure",
  ].join("; ");
}

export function buildClearCookie() {
  return [
    `${ADMIN_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
    "Secure",
  ].join("; ");
}

/**
 * Returns the current web admin from the HttpOnly cookie.
 * Returns null for any failure — callers must treat null as unauthorized.
 */
export async function getCurrentAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = verifyAdminToken(token);
    if (!payload) return null;

    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
    });

    if (!admin) return null;
    if (!admin.active) return null;
    if (!isAllowedAdminRole(admin.role)) return null;

    return admin;
  } catch {
    return null;
  }
}

type AuthenticatedAdmin = NonNullable<Awaited<ReturnType<typeof getCurrentAdmin>>>;

export type AdminAuthResult = {
  admin: AuthenticatedAdmin;
  /**
   * "bearer": authenticated via Authorization header (mobile session or JWT).
   * "cookie": authenticated via the HttpOnly admin_token cookie (browser; needs CSRF).
   * An invalid Bearer header that falls back to the cookie counts as "cookie".
   */
  method: "bearer" | "cookie";
};

/**
 * Returns the current admin plus how they authenticated, checking in order:
 * 1. Flutter/mobile Bearer session token,
 * 2. Bearer admin JWT,
 * 3. Existing web admin HttpOnly cookie.
 */
export async function getAdminAuthFromRequest(
  req: NextRequest
): Promise<AdminAuthResult | null> {
  const bearerAdmin = await getAdminFromBearerToken(req).catch(() => null);
  if (bearerAdmin) return { admin: bearerAdmin, method: "bearer" };

  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  const bearerToken = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearerToken) {
    const payload = verifyAdminToken(bearerToken);
    if (payload?.adminId) {
      const admin = await prisma.admin.findUnique({
        where: { id: payload.adminId },
      });

      if (admin?.active && isAllowedAdminRole(admin.role)) {
        return { admin, method: "bearer" };
      }
    }
  }

  const cookieAdmin = await getCurrentAdmin();
  return cookieAdmin ? { admin: cookieAdmin, method: "cookie" } : null;
}

/**
 * Returns the current admin from either:
 * 1. Flutter/mobile Bearer token, or
 * 2. Existing web admin HttpOnly cookie.
 *
 * Bearer token is checked first so mobile API calls can reuse existing admin APIs.
 */
export async function getCurrentAdminFromRequest(req: NextRequest) {
  return (await getAdminAuthFromRequest(req))?.admin ?? null;
}

export { ADMIN_COOKIE_NAME, SESSION_MAX_AGE_SECONDS };
