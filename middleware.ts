import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isOriginAllowedForApi } from "@/lib/originGuard";
import { logSecurityEvent } from "@/lib/secureLogger";

const SESSION_COOKIE = "admin_token";

const ADMIN_HOME_PATH = "/admin";

function getAdminLoginPath(): string {
  const custom = process.env.ADMIN_LOGIN_PATH?.trim();
  if (custom && custom.startsWith("/")) {
    return custom.replace(/\/+$/, "");
  }
  return "/admin/login";
}

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
    await jwtVerify(token, secret);
    return true;
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

export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  if (shouldTrackRequest(pathname)) {
    event.waitUntil(trackRequest(req, pathname));
  }

  const nonce = generateNonce();
  const cspHeader = buildCspHeader(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

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
      headers.set("x-internal-admin-rewrite", "1");
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

  // If this is an internal rewrite intended to render the admin login page, allow it through
  if (req.headers.get("x-internal-admin-rewrite") === "1" && pathname === "/admin/login") {
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

  // 🛡️ Hide old default login paths if a custom ADMIN_LOGIN_PATH is configured
  if (
    (pathname === "/admin/login" || pathname === "/admin/dystore") &&
    pathname !== adminLoginPath
  ) {
    return rewriteResponse("/_not-found", { status: 404 });
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const isLoggedIn = await isValidAdminToken(token);

  // Login page access
  if (pathname === adminLoginPath) {
    if (isLoggedIn) {
      return redirectResponse(new URL(ADMIN_HOME_PATH, req.url));
    }
    // If custom secret path is configured, rewrite internally to serve the login page
    if (adminLoginPath !== "/admin/login") {
      return rewriteResponse("/admin/login", undefined, true);
    }
    return nextResponse();
  }

  // Protected admin routes: if not logged in, pretend they do not exist (404 Not Found)
  // to prevent leaking the secret ADMIN_LOGIN_PATH to unauthorized visitors
  if (!isLoggedIn && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
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
  ],
};
