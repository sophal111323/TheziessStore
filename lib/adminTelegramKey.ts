import crypto from "crypto";
import jwt from "jsonwebtoken";
import { notifyTelegram, escapeHtml } from "./telegram";

export const ADMIN_KEY_PENDING_COOKIE = "admin_key_pending";
export const TELEGRAM_KEY_LENGTH = 264;
export const TELEGRAM_KEY_TTL_SECONDS = 300; // 5 minutes

function getAdminJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error("ADMIN_JWT_SECRET is not set");
  }
  return secret;
}

/**
 * Generates a cryptographically secure random alphanumeric key of specified length (default 264)
 */
export function generate264Key(): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomBytes = crypto.randomBytes(TELEGRAM_KEY_LENGTH);
  let result = "";
  for (let i = 0; i < TELEGRAM_KEY_LENGTH; i++) {
    result += charset[randomBytes[i] % charset.length];
  }
  return result;
}

export function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey.trim()).digest("hex");
}

export function signTelegramKeyToken(payload: {
  adminId: string;
  email: string;
  keyHash: string;
}): string {
  return jwt.sign(
    {
      type: "admin-telegram-key-pending",
      adminId: payload.adminId,
      email: payload.email,
      keyHash: payload.keyHash,
    },
    getAdminJwtSecret(),
    { expiresIn: TELEGRAM_KEY_TTL_SECONDS }
  );
}

export function verifyTelegramKeyToken(token: string): {
  adminId: string;
  email: string;
  keyHash: string;
} | null {
  try {
    const decoded = jwt.verify(token, getAdminJwtSecret()) as {
      type?: string;
      adminId?: string;
      email?: string;
      keyHash?: string;
    };

    if (
      decoded &&
      decoded.type === "admin-telegram-key-pending" &&
      typeof decoded.adminId === "string" &&
      typeof decoded.email === "string" &&
      typeof decoded.keyHash === "string"
    ) {
      return {
        adminId: decoded.adminId,
        email: decoded.email,
        keyHash: decoded.keyHash,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sends the 264-character key via Telegram Bot
 */
export async function sendTelegramKeyMessage(email: string, rawKey: string): Promise<boolean> {
  // Always log in development so the admin is never locked out if Telegram is delayed
  console.log(
    `\n🔑 ==================== [ADMIN TELEGRAM 264-CHAR KEY] ====================\n` +
    `Admin: ${email}\n` +
    `Key (264 characters):\n${rawKey}\n` +
    `========================================================================\n`
  );

  const message = [
    `🔐 <b>TheziessStore — Admin Login Security Key</b>`,
    ``,
    `👤 <b>Admin:</b> <code>${escapeHtml(email)}</code>`,
    `🔑 <b>Security Key (264 characters):</b>`,
    `<code>${rawKey}</code>`,
    ``,
    `⏱ <i>Key នេះមានសុពលភាពរយៈពេល 5 នាទី។ សូម Copy Key នេះយកទៅ Paste ក្នុងផ្ទាំង Admin Login ដើម្បីបញ្ចប់ការចូលប្រព័ន្ធ។</i>`,
  ].join("\n");

  return await notifyTelegram(message);
}

/**
 * Saves a bot-generated key hash to the DB with 5-minute expiry
 */
export async function saveTelegramBotKey(rawKey: string): Promise<void> {
  const hash = hashKey(rawKey);
  const identifier = `telegram-bot-key:${hash}`;
  const expiresAt = new Date(Date.now() + TELEGRAM_KEY_TTL_SECONDS * 1000);

  // Clean up any old expired bot keys
  const { prisma } = await import("./prisma");
  await prisma.adminAuthLock.deleteMany({
    where: {
      identifier: { startsWith: "telegram-bot-key:" },
      lockedUntil: { lt: new Date() },
    },
  }).catch(() => {});

  // Upsert new bot key
  await prisma.adminAuthLock.upsert({
    where: { identifier },
    update: { lockedUntil: expiresAt },
    create: { identifier, lockedUntil: expiresAt },
  });
}

/**
 * Checks if a key was generated via Telegram Bot command and is still active.
 * If valid, consumes it immediately so it can only be used once.
 */
export async function verifyAndConsumeTelegramBotKey(rawKey: string): Promise<boolean> {
  const hash = hashKey(rawKey);
  const identifier = `telegram-bot-key:${hash}`;

  const { prisma } = await import("./prisma");
  const record = await prisma.adminAuthLock.findUnique({
    where: { identifier },
  });

  if (!record) return false;

  if (record.lockedUntil && record.lockedUntil < new Date()) {
    await prisma.adminAuthLock.delete({ where: { identifier } }).catch(() => {});
    return false;
  }

  // Consume the key immediately
  await prisma.adminAuthLock.delete({ where: { identifier } }).catch(() => {});
  return true;
}


