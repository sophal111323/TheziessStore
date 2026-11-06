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

  // Telegram sends this back as x-telegram-bot-api-secret-token; the webhook
  // route requires it in production (TELEGRAM_WEBHOOK_SECRET).
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secretToken) {
    console.warn("TELEGRAM_WEBHOOK_SECRET is not set: the production webhook will reject every update.");
  }

  const params = new URLSearchParams({ url: webhookUrl });
  if (secretToken) params.set("secret_token", secretToken);

  console.log(`Setting Telegram webhook to: ${webhookUrl}${secretToken ? " (with secret_token)" : ""}...`);

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?${params.toString()}`);
  const data = await res.json();
  console.log("Telegram response:", data);
}

main().catch(console.error);

