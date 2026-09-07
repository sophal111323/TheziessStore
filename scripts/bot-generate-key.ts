import { generate264Key, saveTelegramBotKey, TELEGRAM_KEY_LENGTH } from "../lib/adminTelegramKey";
import { notifyTelegram } from "../lib/telegram";

async function main() {
  console.log("Generating new 264-character Admin Security Key (Simulating Telegram Bot /getkey command)...");

  const key = generate264Key();
  await saveTelegramBotKey(key);

  console.log("\n=======================================================");
  console.log("🔐 THEZIESS STORE — TELEGRAM BOT 264-CHAR KEY GENERATED");
  console.log("=======================================================");
  console.log(`Length: ${key.length} characters`);
  console.log(`Valid for: 5 minutes`);
  console.log("\nKey:");
  console.log(key);
  console.log("=======================================================\n");

  const sent = await notifyTelegram(
    `🔐 <b>TheziessStore — Admin Security Key (Bot Generated)</b>\n\n` +
    `🔑 <b>Key (${TELEGRAM_KEY_LENGTH} characters):</b>\n` +
    `<code>${key}</code>\n\n` +
    `⏱ <i>Valid for 5 minutes.</i>`
  );
  console.log("Telegram notification sent?:", sent);
}

main().catch(console.error);

