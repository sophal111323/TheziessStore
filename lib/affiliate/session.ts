import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { getAffiliateById } from "./store";
import { Affiliate } from "./types";

export const CREATOR_COOKIE_NAME = "theziess_creator_session";
export const CREATOR_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/** Fails closed: no hard-coded fallback secret (ATK-13). */
function getSecret(): string {
  const secret = process.env.CREATOR_JWT_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error("CREATOR_JWT_SECRET or ADMIN_JWT_SECRET must be set");
  }
  return secret;
}

export function signCreatorToken(affiliateId: string): string {
  return jwt.sign({ affiliateId, type: "creator_session" }, getSecret(), {
    algorithm: "HS256",
    expiresIn: CREATOR_SESSION_MAX_AGE_SECONDS,
  });
}

export function verifyCreatorToken(token: string): { affiliateId: string } | null {
  try {
    const payload = jwt.verify(token, getSecret(), { algorithms: ["HS256"] }) as any;
    if (payload && payload.affiliateId && payload.type === "creator_session") {
      return { affiliateId: String(payload.affiliateId) };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns safe affiliate data excluding sensitive credentials like passwordHash.
 */
export function toSafeAffiliate<T extends { passwordHash?: string }>(
  affiliate: T
): Omit<T, "passwordHash"> {
  const copy = { ...affiliate };
  delete copy.passwordHash;
  return copy;
}

export async function getCurrentCreator(): Promise<Affiliate | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREATOR_COOKIE_NAME)?.value;
  if (!token) return null;

  const verified = verifyCreatorToken(token);
  if (!verified) return null;

  const affiliate = getAffiliateById(verified.affiliateId);
  if (!affiliate || affiliate.status === "SUSPENDED") {
    return null;
  }

  return affiliate;
}

