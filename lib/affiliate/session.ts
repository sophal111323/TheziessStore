import { cookies } from "next/headers";
import { getAffiliateById, getAffiliateByUsername } from "./store";
import { Affiliate } from "./types";

export const CREATOR_COOKIE_NAME = "theziess_creator_session";

export async function getCurrentCreator(): Promise<Affiliate | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREATOR_COOKIE_NAME)?.value;
  if (!token) return null;

  // Supports either affiliate id (e.g. aff-davin) or username (e.g. davin)
  const affiliate = getAffiliateById(token) || getAffiliateByUsername(token);
  if (!affiliate || affiliate.status === "SUSPENDED") {
    return null;
  }

  return affiliate;
}

