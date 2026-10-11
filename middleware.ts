import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isOriginAllowedForApi } from "@/lib/originGuard";
import { logSecurityEvent } from "@/lib/secureLogger";
import { isAdminSessionClaims } from "@/lib/adminSessionClaims";
import { getAdminLoginPath } from "@/lib/adminLoginPath";
import { checkOriginLock, ORIGIN_LOCK_HEADER } from "@/lib/originLock";
import { normalizePathForChecks } from "@/lib/pathNormalize";
import { timingSafeEqualString } from "@/lib/secretCompare";

const SESSION_COOKIE = "admin_token";

const ADMIN_HOME_PATH = "/admin";

const INTERNAL_REWRITE_HEADER = "x-internal-admin-rewrite";

// Per-instance random token for the internal login-page rewrite (ATK-10).
// Never derived from a configured secret and never hard-coded.
const INTERNAL_REWRITE_TOKEN = Array.from(
  crypto.getRandomValues(new Uint8Array(32)),
  (b) => b.toString(16).padStart(2, "0")
).join("");

function isAdminArea(pathname: string, adminLoginPath: string): boolean {
  return (
    pathname === adminLoginPath ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin")
  );
}

function getSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    return null;
  }

  return new TextEncoder().encode(secret);
}

async function isValidAdminToken(token?: string) {
  const secret = getSecret();

  if (!token || !secret) {
    return false;
  }

  try {
    // HS256 pinned + typed session claims: pending-2FA, Telegram-key,
    // lock-hint, customer and creator JWTs are not admin sessions (ATK-02/03).
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return isAdminSessionClaims(payload);
  } catch {
    return false;
  }
}

function parseUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();

  const os =
    ua.includes("android") ? "Android" :
    ua.includes("iphone") || ua.includes("ios") ? "iOS" :
    ua.includes("windows") ? "Windows" :
    ua.includes("mac os") ? "macOS" :
    "Unknown";

  const browser =
    ua.includes("edg") ? "Edge" :
    ua.includes("chrome") ? "Chrome" :
    ua.includes("safari") ? "Safari" :
    ua.includes("firefox") ? "Firefox" :
    "Unknown";

  const device =
    ua.includes("mobile") ? "Mobile" :
    ua.includes("tablet") ? "Tablet" :
    "Desktop/Unknown";

  return { os, browser, device };
}

function getRequestIp(req: NextRequest): string {
  // Cloudflare overwrites cf-connecting-ip with the real client IP, so a
  // client can't spoof it when traffic goes through Cloudflare. Keep in sync
  // with lib/getIp.ts.
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

function shouldTrackRequest(pathname: string): boolean {
  if (!process.env.INTERNAL_SECURITY_SECRET) return false;

  // Avoid loops and noisy internal/admin-only traffic.
  if (pathname.startsWith("/api/security/track")) return false;
  if (pathname.startsWith("/api/cron")) return false;
  if (pathname.startsWith("/api/admin")) return false;
  if (pathname.startsWith("/admin")) return false;

  return true;
}

// ── API origin guard exemptions ──────────────────────────────────────────
// These endpoints authenticate via HMAC signatures or shared secrets
// (not browser origins), so the origin guard must never apply to them.
const ORIGIN_GUARD_EXEMPT_PREFIXES = [
  "/api/payment/webhook", // Tola Saint webhook — HMAC-SHA256 signed
  "/api/webhooks/", // FrozenYuki webhook — HMAC-SHA256 signed
  "/api/cron/", // Vercel cron — CRON_SECRET gated
  "/api/security/track", // middleware's own internal fetch — INTERNAL_SECURITY_SECRET gated
  "/api/health", // uptime monitors
  "/api/check-ip", // admin-gated diagnostic (Flutter admin calls)
  "/api/public/", // public metadata (app version) — Flutter apps
  "/api/uploads/", // public images (hotlinking allowed)
  "/api/cdn/", // public image proxy (hotlinking allowed)
];

function isOriginGuardExempt(pathname: string): boolean {
  return ORIGIN_GUARD_EXEMPT_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p)
  );
}

async function trackRequest(req: NextRequest, pathname: string) {
  try {
    const userAgent = req.headers.get("user-agent") || "";
    const { os, browser, device } = parseUserAgent(userAgent);

    await fetch(new URL("/api/security/track", req.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_SECURITY_SECRET || "",
      },
      body: JSON.stringify({
        ip: getRequestIp(req),
        path: pathname,
        method: req.method,
        country: req.headers.get("cf-ipcountry") || null,
        userAgent,
        os,
        browser,
        device,
        referer: req.headers.get("referer") || null,
      }),
      cache: "no-store",
    });
  } catch {
    // Never break the site if analytics logging fails.
  }
}

function generateNonce(): string {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))
  );
}

function buildCspHeader(nonce: string): string {
  const turnstile = "https://challenges.cloudflare.com";
  const isDev = process.env.NODE_ENV === "development";

  // Strict script-src: nonce-based, conditionally include 'unsafe-eval' ONLY in development
  // for React Fast Refresh / HMR, strictly removed in production.
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'unsafe-eval' ${turnstile}`
    : `'self' 'nonce-${nonce}' ${turnstile}`;

  // Strict style-src: nonce-based, no unsafe-eval
  const styleSrc = `'self' 'nonce-${nonce}' https://fonts.googleapis.com`;

  // Specific image sources - no wildcard scheme (no https:)
  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    "https://res.cloudinary.com",
    "https://i.ibb.co",
    "https://api.qrserver.com",
    "https://img.freepik.com",
  ].join(" ");

  // Specific connect sources - allow local dev sockets only in development
  const connectSrc = [
    "'self'",
    isDev ? "http://localhost:* ws://localhost:* wss:" : "",
    turnstile,
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
    "https://res.cloudinary.com",
    "https://api.qrserver.com",
    "https://i.ibb.co",
    "https://img.freepik.com",
    "https://tolasaint.com",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `style-src-elem 'self' 'nonce-${nonce}' ${isDev ? "'unsafe-inline'" : ""} https://fonts.googleapis.com`,
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src ${imgSrc}`,
    `connect-src ${connectSrc}`,
    `frame-src 'self' ${turnstile}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    isDev ? "" : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ");
}

function addSecurityHeaders(
  response: NextResponse,
  cspHeader: string,
  nonce: string
): NextResponse {
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("x-nonce", nonce);

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  // Prevent information disclosure (mask Server & strip X-Powered-By)
  response.headers.delete("x-powered-by");
  response.headers.delete("X-Powered-By");
  response.headers.set("Server", "web");

  return response;
}

/** Remove one cookie from a forwarded Cookie header, keeping the others verbatim. */
function stripRequestCookie(headers: Headers, name: string): void {
  const raw = headers.get("cookie");
  if (!raw) return;

  const kept = raw
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && part.split("=")[0]?.trim() !== name);

  if (kept.length > 0) {
    headers.set("cookie", kept.join("; "));
  } else {
    headers.delete("cookie");
  }
}

/** Max distinct IP keys kept by the per-instance admin-path scan limiter. */
const ADMIN_PATH_RATE_LIMIT_MAX_KEYS = 5000;

/**
 * Keep the admin-path limiter map bounded (pure Map logic, Edge-compatible).
 * When over the cap: drop keys whose newest timestamp is outside the window,
 * then evict the least recently updated keys (Map iteration order) until
 * the size is back under the cap.
 */
function boundAdminPathRateLimit(store: Map<string, number[]>, cutoff: number): void {
  if (store.size <= ADMIN_PATH_RATE_LIMIT_MAX_KEYS) return;

  for (const [key, timestamps] of store) {
    const newest = timestamps.length > 0 ? timestamps[timestamps.length - 1] : 0;
    if (newest <= cutoff) store.delete(key);
  }

  for (const key of store.keys()) {
    if (store.size < ADMIN_PATH_RATE_LIMIT_MAX_KEYS) break;
    store.delete(key);
  }
}

export async function middleware(req: NextRequest, event: NextFetchEvent) {
  // Canonical path for every check below (ATK-11): decoded, no "//", no trailing "/".
  const pathname = normalizePathForChecks(req.nextUrl.pathname);

  const nonce = generateNonce();
  const cspHeader = buildCspHeader(nonce);

  // ✅ Opt-in origin lock (ATK-06): when ORIGIN_SHARED_SECRET is set, only
  // requests carrying the Cloudflare-injected x-origin-secret get through.
  const originLock = checkOriginLock({
    pathname,
    headerValue: req.headers.get(ORIGIN_LOCK_HEADER),
    secret: process.env.ORIGIN_SHARED_SECRET,
  });
  if (!originLock.ok) {
    logSecurityEvent({
      event: "origin_lock_blocked",
      detail: `path=${pathname}; reason=${originLock.reason}`,
      ip: getRequestIp(req),
    });

    return addSecurityHeaders(
      new NextResponse(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }),
      cspHeader,
      nonce
    );
  }

  if (shouldTrackRequest(pathname)) {
    event.waitUntil(trackRequest(req, pathname));
  }

  // Read the internal rewrite marker before stripping it from forwarded headers.
  const incomingRewriteHeader = req.headers.get(INTERNAL_REWRITE_HEADER);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  // Never forward the origin secret or a client-supplied rewrite marker.
  requestHeaders.delete(ORIGIN_LOCK_HEADER);
  requestHeaders.delete(INTERNAL_REWRITE_HEADER);

  // ✅ API origin guard (Edge-safe): browser calls to /api/* must be
  // same-origin or explicitly allowlisted via API_ALLOWED_ORIGINS /
  // PUBLIC_APP_URL / NEXT_PUBLIC_BASE_URL. Non-browser callers (Flutter
  // apps, curl, uptime monitors) send no Origin header and pass — they are
  // only refused when Sec-Fetch-Site marks them as cross-site browser
  // subresource abuse. Signature/secret-authenticated endpoints are
  // exempt (ORIGIN_GUARD_EXEMPT_PREFIXES above). No CORS response headers
  // are emitted: the public API is same-origin by design.
  if (pathname.startsWith("/api/") && !isOriginGuardExempt(pathname)) {
    const originCheck = isOriginAllowedForApi(req);
    if (!originCheck.ok) {
      logSecurityEvent({
        event: "origin_blocked",
        detail: `path=${pathname}; reason=${originCheck.reason}`,
        ip: getRequestIp(req),
      });

      return addSecurityHeaders(
        new NextResponse(
          JSON.stringify({ error: "Forbidden" }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          }
        ),
        cspHeader,
        nonce
      );
    }
  }

  function nextResponse(): NextResponse {
    return addSecurityHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
      cspHeader,
      nonce
    );
  }

  function redirectResponse(url: URL): NextResponse {
    return addSecurityHeaders(
      NextResponse.redirect(url),
      cspHeader,
      nonce
    );
  }

  function rewriteResponse(path: string, init?: { status?: number }, internalAdmin = false): NextResponse {
    const url = req.nextUrl.clone();
    url.pathname = path;
    // Behind reverse proxy (Nginx), internal Next.js rewrite fetches must use http to localhost
    url.protocol = "http:";
    const headers = new Headers(requestHeaders);
    if (internalAdmin) {
      headers.set(INTERNAL_REWRITE_HEADER, INTERNAL_REWRITE_TOKEN);
    } else {
      headers.delete(INTERNAL_REWRITE_HEADER);
    }
    return addSecurityHeaders(
      NextResponse.rewrite(url, {
        request: {
          headers,
        },
        status: init?.status,
      }),
      cspHeader,
      nonce
    );
  }

  const adminLoginPath = getAdminLoginPath();

  // If this is an authentic internal rewrite intended to render the admin login page, allow it through
  const isAuthorizedInternalRewrite = timingSafeEqualString(
    incomingRewriteHeader,
    INTERNAL_REWRITE_TOKEN
  );

  if (isAuthorizedInternalRewrite && pathname === "/admin/login") {
    return nextResponse();
  }

  // ✅ Normal pages: only apply CSP/security headers.
  // No need to verify admin JWT outside admin area.
  if (!isAdminArea(pathname, adminLoginPath)) {
    return nextResponse();
  }

  // Admin API routes validate cookie/Bearer sessions inside route handlers.
  // Middleware only adds security headers here so Flutter Bearer tokens are not blocked.
  if (pathname.startsWith("/api/admin")) {
    return nextResponse();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const isLoggedIn = await isValidAdminToken(token);

  // FIND-005 & FIND-013 fix: rate limit admin path scanning.
  // This runs BEFORE the login-path check, so the real secret path counts and
  // gets the same 429 as wrong guesses once an IP is over the limit. If the
  // real path were exempt, a scanner would still see a lone 200 among 429s.
  const isAdminPathRequest =
    pathname === "/admin" || pathname.startsWith("/admin/") || pathname === adminLoginPath;
  if (!isLoggedIn && isAdminPathRequest) {
    const ip = getRequestIp(req);
    const rlKey = `admin-path-scan:${ip}`;

    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxAttempts = 10;

    // Simple in-memory rate limit for middleware (Edge-compatible, per instance)
    const rateStore = globalThis as any;
    if (!rateStore.__adminPathRateLimit) {
      rateStore.__adminPathRateLimit = new Map<string, number[]>();
    }
    const adminPathRateLimit: Map<string, number[]> = rateStore.__adminPathRateLimit;

    const cutoff = now - windowMs;
    const timestamps = (adminPathRateLimit.get(rlKey) ?? []).filter((t: number) => t > cutoff);

    if (timestamps.length >= maxAttempts) {
      logSecurityEvent({
        event: "admin_path_scan_rate_limit",
        detail: `Excessive admin path scanning: ${pathname}`,
        ip,
      });
      return addSecurityHeaders(
        new NextResponse(JSON.stringify({ error: "Too many requests" }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
            "Cache-Control": "no-store",
          },
        }),
        cspHeader,
        nonce
      );
    }

    timestamps.push(now);
    // Re-insert so Map iteration order runs from least to most recently updated.
    adminPathRateLimit.delete(rlKey);
    adminPathRateLimit.set(rlKey, timestamps);
    boundAdminPathRateLimit(adminPathRateLimit, cutoff);
  }

  // 🛡️ Hide old default login paths if a custom ADMIN_LOGIN_PATH is configured
  if (
    (pathname === "/admin/login" || pathname === "/admin/dystore") &&
    pathname !== adminLoginPath
  ) {
    return rewriteResponse("/_not-found", { status: 404 });
  }

  // Login page access
  if (pathname === adminLoginPath) {
    if (isLoggedIn) {
      return redirectResponse(new URL(ADMIN_HOME_PATH, req.url));
    }

    // A present-but-invalid session cookie (expired, or issued before the
    // typed admin-session claim) makes app/admin/layout.tsx redirect back
    // to this path forever. Drop it from the forwarded request and clear it.
    const hasStaleSession = Boolean(token);
    if (hasStaleSession) {
      stripRequestCookie(requestHeaders, SESSION_COOKIE);
    }

    // If custom secret path is configured, rewrite internally to serve the login page
    const response =
      adminLoginPath !== "/admin/login"
        ? rewriteResponse("/admin/login", undefined, true)
        : nextResponse();

    if (hasStaleSession) {
      response.cookies.set(SESSION_COOKIE, "", {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
    }
    return response;
  }

  // Protected admin routes: if not logged in, pretend they do not exist (404 Not Found)
  // to prevent leaking the secret ADMIN_LOGIN_PATH to unauthorized visitors
  if (!isLoggedIn && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    // Rate limiting for this case already ran above (see FIND-005 block).
    return rewriteResponse("/_not-found", { status: 404 });
  }

  // Logged in: allow access
  return nextResponse();
}

export const config = {
  matcher: [
    /*
      Apply CSP/security headers to normal pages and API routes,
      but skip Next.js static/image assets and common static files.
    */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)$).*)",
    // ATK-11: API and admin paths always run middleware, even when they end
    // in an excluded extension (e.g. /api/orders/X.png, /admin/x.js).
    "/api/:path*",
    "/admin/:path*",
  ],
};
