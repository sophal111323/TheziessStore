import crypto from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.TELEGRAM_JWT_SECRET ||
  process.env.ADMIN_JWT_SECRET ||
  process.env.INTERNAL_SECURITY_SECRET ||
  "theziess-telegram-secret-fallback-key-32chars";

export interface VerifiedTelegramUser {
  telegramUserId: number;
  username: string | null;
  firstName: string;
  lastName: string | null;
  languageCode: string | null;
  authDate: number;
  queryId?: string | null;
}

export type ValidationResult =
  | { valid: true; user: VerifiedTelegramUser }
  | { valid: false; error: string };

/**
 * Validates Telegram Mini App initData according to the official Telegram specification:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Security:
 * - Computes secret key via HMAC-SHA256("WebAppData", botToken)
 * - Verifies data-check-string against provided hash using timing-safe comparison
 * - Rejects tampered data or expired auth_date (> 24 hours)
 */
export function verifyTelegramInitData(
  initData: string,
  botToken?: string,
  maxAgeSeconds = 86400
): ValidationResult {
  if (!initData || typeof initData !== "string") {
    return { valid: false, error: "Empty or missing initData" };
  }

  const token = (botToken || process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) {
    return { valid: false, error: "Server TELEGRAM_BOT_TOKEN is not configured" };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) {
      return { valid: false, error: "Missing hash in initData" };
    }

    const authDateStr = params.get("auth_date");
    if (!authDateStr) {
      return { valid: false, error: "Missing auth_date in initData" };
    }

    const authDate = parseInt(authDateStr, 10);
    if (isNaN(authDate)) {
      return { valid: false, error: "Invalid auth_date format" };
    }

    const now = Math.floor(Date.now() / 1000);
    // Disallow timestamps more than maxAgeSeconds old or more than 5 minutes in the future (clock skew)
    if (now - authDate > maxAgeSeconds) {
      return { valid: false, error: "Telegram initData has expired" };
    }
    if (authDate - now > 300) {
      return { valid: false, error: "Telegram initData timestamp is in the future" };
    }

    // Sort parameters alphabetically excluding 'hash'
    const pairs: string[] = [];
    params.forEach((value, key) => {
      if (key !== "hash") {
        pairs.push(`${key}=${value}`);
      }
    });
    pairs.sort();
    const dataCheckString = pairs.join("\n");

    // 1. secret_key = HMAC_SHA256("WebAppData", bot_token)
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(token)
      .digest();

    // 2. calculated_hash = HMAC_SHA256(secret_key, data_check_string)
    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    // 3. Constant-time comparison to prevent timing attacks
    const hashBuffer = Buffer.from(hash, "hex");
    const calcBuffer = Buffer.from(calculatedHash, "hex");

    if (
      hashBuffer.length !== calcBuffer.length ||
      !crypto.timingSafeEqual(hashBuffer, calcBuffer)
    ) {
      return { valid: false, error: "Telegram data signature verification failed" };
    }

    // 4. Extract verified user information
    const userRaw = params.get("user");
    if (!userRaw) {
      return { valid: false, error: "No user information found in verified initData" };
    }

    const parsedUser = JSON.parse(userRaw);
    if (!parsedUser.id) {
      return { valid: false, error: "Missing Telegram user ID in user payload" };
    }

    return {
      valid: true,
      user: {
        telegramUserId: Number(parsedUser.id),
        username: parsedUser.username || null,
        firstName: String(parsedUser.first_name || ""),
        lastName: parsedUser.last_name ? String(parsedUser.last_name) : null,
        languageCode: parsedUser.language_code ? String(parsedUser.language_code) : null,
        authDate,
        queryId: params.get("query_id") || null,
      },
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Verification error: ${err?.message || "Unknown error"}`,
    };
  }
}

/**
 * Creates a signed JWT session token for authenticated Telegram Mini App sessions.
 */
export function createCustomerToken(payload: {
  userId: string;
  telegramUserId: string;
  username: string | null;
}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "14d" });
}

/**
 * Verifies customer session JWT token.
 */
export function verifyCustomerToken(token: string): {
  userId: string;
  telegramUserId: string;
  username: string | null;
} | null {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}
