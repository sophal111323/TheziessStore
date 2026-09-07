import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { escapeHtml } from "@/lib/telegram";
import {
  generate264Key,
  saveTelegramBotKey,
  TELEGRAM_KEY_LENGTH,
} from "@/lib/adminTelegramKey";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function sendBotMessage(chatId: string | number, text: string, token: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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
  } catch (err) {
    console.warn("[telegram-webhook] reply failed:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } }).catch(() => null);
    const botToken = settings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
    const authorizedChatId = String(settings?.telegramChatId || process.env.TELEGRAM_CHAT_ID || "");

    if (!botToken) {
      return NextResponse.json({ error: "Telegram Bot Token not configured" }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.message) {
      return NextResponse.json({ ok: true }); // Always return 200 to Telegram
    }

    const message = body.message;
    const chatId = String(message.chat?.id || "");
    const text = (message.text || "").trim();
    const command = text.split(" ")[0].toLowerCase().split("@")[0]; // handle /key@bot_name

    // 🔒 Security: Check if sender is the authorized admin chat ID
    if (authorizedChatId && chatId !== authorizedChatId) {
      await sendBotMessage(
        chatId,
        "⛔ <b>គ្មានសិទ្ធិចូលប្រើប្រាស់ (Access Denied)</b>\nអ្នកមិនមែនជាម្ចាស់ហាង ឬ Admin របស់ TheziessStore ឡើយ។",
        botToken
      );
      return NextResponse.json({ ok: true });
    }

    // ── Command: /getkey, /key, /genkey ─────────────────────────────────────
    if (command === "/getkey" || command === "/key" || command === "/genkey") {
      const newKey = generate264Key();
      await saveTelegramBotKey(newKey);

      const reply = [
        `🔐 <b>TheziessStore — Admin Security Key</b>`,
        ``,
        `✅ <b>បានបង្កើត Security Key ដោយជោគជ័យ៖</b>`,
        `<code>${newKey}</code>`,
        ``,
        `📊 <b>ប្រវែង:</b> ${TELEGRAM_KEY_LENGTH} តួអក្សរ`,
        `⏱ <b>សុពលភាព:</b> 5 នាទី`,
        `💡 <i>សូមចុច Copy Key ខាងលើ យកទៅ Paste ក្នុងផ្ទាំង Admin Login ដើម្បីចូលប្រព័ន្ធ។</i>`,
      ].join("\n");

      await sendBotMessage(chatId, reply, botToken);
      return NextResponse.json({ ok: true });
    }

    // ── Command: /status ────────────────────────────────────────────────────
    if (command === "/status") {
      const [adminCount, orderCount, productCount] = await Promise.all([
        prisma.admin.count({ where: { active: true } }).catch(() => 0),
        prisma.order.count({ where: { status: "PAID" } }).catch(() => 0),
        prisma.product.count({ where: { active: true } }).catch(() => 0),
      ]);

      const reply = [
        `📊 <b>TheziessStore — ស្ថានភាពប្រព័ន្ធ</b>`,
        ``,
        `• <b>ឈ្មោះហាង:</b> ${escapeHtml(settings?.siteName || "TheziessStore")}`,
        `• <b>គណនី Admin:</b> ${adminCount}`,
        `• <b>ការបញ្ជាទិញជោគជ័យ:</b> ${orderCount}`,
        `• <b>ចំនួនផលិតផល:</b> ${productCount}`,
        `• <b>អត្រាប្តូរប្រាក់:</b> 1$ = ${settings?.exchangeRate || 4100} រៀល`,
        `• <b>Bot Status:</b> ✅ Online & Ready`,
      ].join("\n");

      await sendBotMessage(chatId, reply, botToken);
      return NextResponse.json({ ok: true });
    }

    // ── Command: /start, /help ──────────────────────────────────────────────
    if (command === "/start" || command === "/help") {
      const reply = [
        `👋 <b>សូមស្វាគមន៍មកកាន់ TheziessStore Admin Bot!</b>`,
        ``,
        `អ្នកអាចប្រើប្រាស់ Commands ខាងក្រោមនេះ៖`,
        `🔑 <code>/getkey</code> ឬ <code>/key</code> — បង្កើត Security Key (264 តួអក្សរ) សម្រាប់ Login Admin`,
        `📊 <code>/status</code> — ពិនិត្យមើលស្ថានភាពហាង និងការបញ្ជាទិញ`,
        `❓ <code>/help</code> — បង្ហាញព័ត៌មានជំនួយនេះ`,
      ].join("\n");

      await sendBotMessage(chatId, reply, botToken);
      return NextResponse.json({ ok: true });
    }

    // Unknown command
    if (text.startsWith("/")) {
      await sendBotMessage(
        chatId,
        `❓ មិនស្គាល់ Command នេះទេ។ សូមចុច <code>/getkey</code> ដើម្បីបង្កើត Admin Login Key ឬ <code>/help</code> ដើម្បីមើល Commands ទាំងអស់។`,
        botToken
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram-webhook] handler error:", err);
    return NextResponse.json({ ok: true }); // Always 200 for Telegram
  }
}

