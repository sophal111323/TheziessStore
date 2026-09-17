"use client";

import { useEffect } from "react";

export default function AffiliateCookieTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return;
    const maxAge = 60 * 60 * 24 * 30; // 30 days
    document.cookie = `theziess_affiliate=${encodeURIComponent(slug)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }, [slug]);

  return null;
}

