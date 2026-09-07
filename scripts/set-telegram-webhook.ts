/**
 * Helper to set Telegram webhook URL
 * Usage: node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/set-telegram-webhook.ts https://yourdomain.com
 */

async function main() {
  const domain = process.argv[2];
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN not found in .env");
    process.exit(1);
  }

  if (!domain) {
    console.log("Usage: node set-telegram-webhook.ts <YOUR_PUBLIC_DOMAIN_OR_NGROK_URL>");
    console.log("Example: node set-telegram-webhook.ts https://theziessstore.com");
    console.log(`\nOr open this link directly in your browser:`);
    console.log(`https://api.telegram.org/bot${token}/setWebhook?url=https://YOUR_DOMAIN/api/telegram/webhook`);
    return;
  }

  const cleanDomain = domain.replace(/\/+$/, "");
  const webhookUrl = `${cleanDomain}/api/telegram/webhook`;

  console.log(`Setting Telegram webhook to: ${webhookUrl}...`);

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
  const data = await res.json();
  console.log("Telegram response:", data);
}

main().catch(console.error);

