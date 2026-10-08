import { prisma } from "./prisma";

export function getTelegramBotToken(): string {
  return (process.env.TELEGRAM_BOT_TOKEN || "").trim();
}

export function getTelegramMiniAppUrl(): string {
  return (
    process.env.TELEGRAM_MINI_APP_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://theziessstore.vercel.app"
  ).trim();
}

export interface TelegramInlineKeyboardButton {
  text: string;
  web_app?: { url: string };
  url?: string;
  callback_data?: string;
}

/**
 * Send a Telegram message using bot token with optional inline keyboard.
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  replyMarkup?: { inline_keyboard: TelegramInlineKeyboardButton[][] }
): Promise<boolean> {
  const token = getTelegramBotToken();
  if (!token) {
    console.warn("[telegram] Cannot send message: TELEGRAM_BOT_TOKEN is not configured.");
    return false;
  }

  try {
    const body: Record<string, any> = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };

    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("[telegram] sendMessage failed:", res.status, errText.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[telegram] sendMessage error:", err);
    return false;
  }
}

/**
 * Send the official TheziessStore customer welcome card with the "🛒 TOP UP NOW" Mini App button.
 */
export async function sendWelcomeStartMessage(chatId: string | number): Promise<boolean> {
  const miniAppUrl = getTelegramMiniAppUrl();

  const welcomeText = [
    `💜 <b>Welcome to TheziessStore</b>`,
    ``,
    `⚡ <b>Fast Game Top-Up</b>`,
  ].join("\n");

  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: "🛒 TOP UP NOW",
          web_app: {
            url: miniAppUrl,
          },
        },
      ],
    ],
  };

  return sendTelegramMessage(chatId, welcomeText, replyMarkup);
}

/**
 * Configures the persistent bot menu button (bottom left) to open the Mini App.
 */
export async function setTelegramMenuButton(url?: string): Promise<boolean> {
  const token = getTelegramBotToken();
  const miniAppUrl = url || getTelegramMiniAppUrl();
  if (!token) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: {
          type: "web_app",
          text: "🛒 TOP UP NOW",
          web_app: {
            url: miniAppUrl,
          },
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    return res.ok;
  } catch (err) {
    console.warn("[telegram] setChatMenuButton error:", err);
    return false;
  }
}

/**
 * Send a Telegram notification to the store admin using the token + chat id stored in Settings
 * (falls back to env vars). Safe to call from any server code — never throws.
 */
export async function notifyTelegram(text: string): Promise<boolean> {
  try {
    const settings = await prisma.settings
      .findUnique({ where: { id: 1 } })
      .catch(() => null);

    const token = settings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
    const chatId = settings?.telegramChatId || process.env.TELEGRAM_CHAT_ID || "";

    if (!token || !chatId) return false;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[telegram] send failed:", res.status, body.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[telegram] error:", err);
    return false;
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

