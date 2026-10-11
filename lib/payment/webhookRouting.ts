// lib/payment/webhookRouting.ts
//
// Pure mapping from the webhook URL segment (/api/payment/webhook/<method>)
// to the single provider whose signature check and parser may handle it.
// The body and headers never choose the provider (ATK-01).

export type WebhookProvider = "khqrpay" | "jla" | "tolasaint";

const TOLA_SAINT_ALIASES = new Set(["TOLASAINT", "ABA", "BAKONG", "KHQR", "1"]);

export function resolveWebhookProvider(
  method: string | null | undefined
): WebhookProvider | null {
  const norm = String(method ?? "").trim().toUpperCase();
  if (!norm) return null;
  if (norm === "KHQRPAY") return "khqrpay";
  if (norm === "JLA") return "jla";
  if (TOLA_SAINT_ALIASES.has(norm)) return "tolasaint";
  return null;
}
