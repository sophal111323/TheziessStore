/**
 * Standalone Telegram Bot Polling Runner for TheziessStore
 *
 * Usage:
 *   npx tsx scripts/telegram-bot.ts
 *
 * Reads:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_MINI_APP_URL
 */

import fs from "fs";
import path from "path";

// Load .env without external dependencies
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const MINI_APP_URL = (
  process.env.TELEGRAM_MINI_APP_URL ||
  process.env.PUBLIC_APP_URL ||
  "https://theziessstore.vercel.app"
).trim();

if (!BOT_TOKEN) {
  console.error("❌ ERROR: TELEGRAM_BOT_TOKEN is not set in environment.");
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function callTelegram(method: string, data?: Record<string, any>) {
  const url = `${API_BASE}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  return res.json();
}

async function configureBotMenu() {
  try {
    const res = await callTelegram("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "🛒 TOP UP NOW",
        web_app: {
          url: MINI_APP_URL,
        },
      },
    });
    if (res.ok) {
      console.log(`✅ Persistent Menu Button set -> ${MINI_APP_URL}`);
    } else {
      console.warn("⚠️ Failed to set menu button:", res);
    }
  } catch (err) {
    console.warn("⚠️ Could not set menu button:", err);
  }
}

async function handleUpdate(update: any) {
  const message = update.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();
  const firstName = message.from?.first_name || "Gamer";

  console.log(`[Bot] Message received from ${firstName} (${chatId}): "${text}"`);

  if (text.startsWith("/start")) {
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
              url: MINI_APP_URL,
            },
          },
        ],
      ],
    };

    const res = await callTelegram("sendMessage", {
      chat_id: chatId,
      text: welcomeText,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
    });

    if (res.ok) {
      console.log(`✅ Sent /start welcome card to ${chatId}`);
    } else {
      console.error(`❌ Failed to send welcome card to ${chatId}:`, res);
    }
  }
}

async function runBot() {
  console.log("-----------------------------------------");
  console.log("🤖 Starting TheziessStore Telegram Bot...");
  console.log(`🌐 Mini App URL: ${MINI_APP_URL}`);

  // 1. Verify Bot Token
  const me = await callTelegram("getMe");
  if (!me.ok) {
    console.error("❌ Invalid TELEGRAM_BOT_TOKEN or Telegram API unreachable:", me);
    process.exit(1);
  }
  console.log(`✅ Bot verified: @${me.result.username} (${me.result.first_name})`);

  // 2. Clear webhook if any so polling works
  await callTelegram("deleteWebhook", { drop_pending_updates: false });
  console.log("✅ Webhook cleared for long-polling mode.");

  // 3. Configure Chat Menu Button
  await configureBotMenu();

  console.log("🚀 Listening for /start messages... (Press Ctrl+C to stop)");
  console.log("-----------------------------------------");

  let offset = 0;
  let isRunning = true;

  process.on("SIGINT", () => {
    console.log("\n👋 Stopping bot...");
    isRunning = false;
    process.exit(0);
  });

  while (isRunning) {
    try {
      const res = await callTelegram("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message"],
      });

      if (res.ok && Array.isArray(res.result)) {
        for (const update of res.result) {
          offset = update.update_id + 1;
          await handleUpdate(update);
        }
      }
    } catch (err) {
      console.warn("⚠️ Network polling hiccup, retrying in 3s...", err);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

runBot();
