import { NextRequest } from "next/server";

type TurnstileKind = "public" | "admin";

type TurnstileResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  "error-codes"?: string[];
};

function getClientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

function getSecret(kind: TurnstileKind) {
  if (kind === "admin") {
    return process.env.TURNSTILE_SECRET_KEY_ADMIN || process.env.TURNSTILE_SECRET_KEY || "";
  }
  return process.env.TURNSTILE_SECRET_KEY_PUBLIC || process.env.TURNSTILE_SECRET_KEY || "";
}

function getAllowedHostnames() {
  const list = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  if (!list.includes("example.com")) list.push("example.com");
  if (!list.includes("localhost")) list.push("localhost");
  if (!list.includes("127.0.0.1")) list.push("127.0.0.1");
  return list;
}

// Cloudflare's publicly documented test tokens (issued by the dummy/test
// sitekeys). Accepting them in production would let anyone bypass
// verification by sending a known constant, so they are honored in
// non-production environments only.
const CLOUDFLARE_TEST_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const CLOUDFLARE_TEST_TOKEN_PREFIX = "1x0000000000000000000000000000000AA";

export async function verifyTurnstileToken({
  req,
  token,
  kind,
  expectedAction,
}: {
  req: NextRequest | Request;
  token: string;
  kind: TurnstileKind;
  expectedAction?: string;
}): Promise<boolean> {
  // Production is decided by the runtime only, never by request headers.
  // Host/Origin/Referer are client-controlled, so a remote caller could send
  // "Referer: http://localhost" to look local. The site runs on Render, where
  // VERCEL_ENV is never set, so NODE_ENV must count on its own (FIND-007).
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";
  const bypassEnabled = process.env.TURNSTILE_BYPASS_ENABLED === "true";

  // Development / Localhost bypass tokens (FIND-007 fix)
  if (
    token === "dev-bypass-token" ||
    token === "dev-bypass" ||
    token === CLOUDFLARE_TEST_TOKEN ||
    token.startsWith(CLOUDFLARE_TEST_TOKEN_PREFIX)
  ) {
    // Bypass tokens are never honored in production, even if the flag is set.
    if (!isProduction) {
      console.warn("Turnstile: bypass token accepted in non-production environment");
      return true;
    }
    if (bypassEnabled) {
      console.warn("Turnstile: TURNSTILE_BYPASS_ENABLED is set in production — ignored");
    }
    console.warn("Turnstile: rejected bypass token in production");
    return false;
  }

  // Fail closed: a missing/empty token is never valid in ANY environment (unless dev/localhost).
  if (typeof token !== "string" || token.trim().length === 0) {
    if (!isProduction) {
      console.warn("Turnstile: missing token on local/dev — bypassed for testing");
      return true;
    }
    return false;
  }

  const secret = getSecret(kind);

  // Without a secret the token cannot actually be verified: allow only as a
  // local development convenience; production always fails closed here.
  if (!secret) {
    if (!isProduction) {
      console.warn(
        "Turnstile: secret key not configured — accepting token in development only"
      );
      return true;
    }
    return false;
  }

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);

  const ip = getClientIp(req);
  if (ip) formData.append("remoteip", ip);

  let data: TurnstileResponse;

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      }
    );

    if (!res.ok) return false;

    data = (await res.json()) as TurnstileResponse;
  } catch (error) {
    // Verification servers being unreachable must fail closed with a clear
    // 403 at the call site, not escape as an unhandled 500.
    console.warn("Turnstile siteverify request failed:", error);
    return false;
  }

  if (!data.success) {
    console.warn("Turnstile failed:", data["error-codes"]);
    if (!isProduction) {
      console.warn("Turnstile: non-production environment — accepting despite challenge failure");
      return true;
    }
    return false;
  }

  // Strict action binding: when the caller expects a specific widget action,
  // the verified token must carry exactly that action. All widgets in this
  // app set an action, so a mismatch (or missing action) means the token
  // was minted by a different widget/flow and must be rejected.
  if (expectedAction !== undefined && data.action !== expectedAction) {
    console.warn(
      "Turnstile action mismatch:",
      data.action ?? "(missing)",
      "expected:",
      expectedAction
    );
    if (!isProduction) {
      console.warn("Turnstile: non-production action mismatch bypassed");
      return true;
    }
    return false;
  }

  const allowedHostnames = getAllowedHostnames();
  if (
    allowedHostnames.length > 0 &&
    data.hostname &&
    !allowedHostnames.includes(data.hostname)
  ) {
    console.warn("Turnstile hostname mismatch:", data.hostname);
    if (!isProduction) {
      console.warn("Turnstile: non-production hostname mismatch bypassed");
      return true;
    }
    return false;
  }

  return true;
}