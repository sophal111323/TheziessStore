// lib/redeem.ts
//
// Utility functions for extracting and parsing Redeem Codes / Vouchers
// from supplier responses and order records.

export function extractRedeemCodeFromResponse(data: any): string | null {
  if (!data || typeof data !== "object") return null;

  // Direct candidate keys
  const keys = [
    "voucher",
    "voucher_code",
    "voucherCode",
    "pin",
    "card_pin",
    "cardPin",
    "serial",
    "sn",
    "code",
    "redeem_code",
    "redeemCode",
    "gift_code",
    "giftCode",
    "token",
  ];

  for (const k of keys) {
    const val = data[k];
    if (
      typeof val === "string" &&
      val.trim().length >= 4 &&
      !["0", "success", "ok", "true", "false", "pending", "processing", "completed"].includes(
        val.toLowerCase()
      )
    ) {
      return val.trim();
    }
  }

  // Nested in data, result, item, or payload
  const nested = data.data || data.result || data.item || data.payload;
  if (nested && typeof nested === "object") {
    const fromNested = extractRedeemCodeFromResponse(nested);
    if (fromNested) return fromNested;
  }

  // Arrays (e.g. cards: [{ pin: "..." }] or items: [{ code: "..." }])
  const arr = data.cards || data.items || data.vouchers;
  if (Array.isArray(arr) && arr.length > 0) {
    for (const item of arr) {
      if (typeof item === "string" && item.trim().length >= 4) return item.trim();
      if (typeof item === "object") {
        const fromItem = extractRedeemCodeFromResponse(item);
        if (fromItem) return fromItem;
      }
    }
  }

  return null;
}

export function extractRedeemCode(order?: {
  deliveryNote?: string | null;
  supplierResponse?: string | null;
} | null): string | null {
  if (!order) return null;

  // 1. Check deliveryNote
  if (order.deliveryNote) {
    const dn = order.deliveryNote.trim();
    const match = dn.match(
      /(?:Redeem Code|Code|PIN|Voucher|Serial|Gift Code)[:\s]+([A-Za-z0-9-_]{4,})/i
    );
    if (match && match[1]) {
      return match[1].trim();
    }
    // If deliveryNote is directly a code (e.g. ABCD-1234-EFGH)
    if (
      /^[A-Za-z0-9-_]{6,40}$/.test(dn) &&
      !dn.toLowerCase().includes("delivered") &&
      !dn.toLowerCase().includes("processing") &&
      !dn.toLowerCase().includes("ref:")
    ) {
      return dn;
    }
  }

  // 2. Check supplierResponse JSON
  if (order.supplierResponse) {
    try {
      const parsed =
        typeof order.supplierResponse === "string"
          ? JSON.parse(order.supplierResponse)
          : order.supplierResponse;
      const code = extractRedeemCodeFromResponse(parsed);
      if (code) return code;
    } catch {}
  }

  return null;
}
