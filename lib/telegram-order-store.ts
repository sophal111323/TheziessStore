import fs from "fs";
import path from "path";

export interface TelegramOrderEntry {
  orderNumber: string;
  chatId: string | number;
  messageId: number;
  gameName: string;
  itemName: string;
  playerUid: string;
  serverId?: string | null;
  playerNickname?: string | null;
  amountUsd: number;
  createdAtTime: string;
  paidAtTime: string;
  status: "PROCESSING" | "DELIVERED" | "FAILED" | "SPIN_PENDING" | "SPIN_SPUN" | "SPIN_COMPLETED";
  isRandomSpin?: boolean;
  spinUrl?: string | null;
  deliveredAtTime?: string | null;
  failedAtTime?: string | null;
  redeemCode?: string | null;
  error?: string | null;
  updatedAt: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "telegram-orders.json");
const MAX_ENTRIES = 5000;

let memoryCache: Map<string, TelegramOrderEntry> | null = null;

function ensureCacheLoaded(): Map<string, TelegramOrderEntry> {
  if (memoryCache !== null) {
    return memoryCache;
  }

  memoryCache = new Map<string, TelegramOrderEntry>();

  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.orderNumber && item.messageId) {
              memoryCache.set(String(item.orderNumber).toUpperCase(), item);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("[telegram-order-store] Failed to load store file:", err);
  }

  return memoryCache;
}

function flushCacheToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const cache = ensureCacheLoaded();
    const entries = Array.from(cache.values());

    // Keep the latest entries bounded
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => b.updatedAt - a.updatedAt);
      entries.length = MAX_ENTRIES;
    }

    fs.writeFileSync(STORE_FILE, JSON.stringify(entries, null, 2), "utf-8");
  } catch (err) {
    console.warn("[telegram-order-store] Failed to write store file:", err);
  }
}

export function getTelegramOrderEntry(orderNumber: string): TelegramOrderEntry | undefined {
  const clean = String(orderNumber || "").trim().toUpperCase();
  if (!clean) return undefined;
  const cache = ensureCacheLoaded();
  return cache.get(clean);
}

export function saveTelegramOrderEntry(entry: TelegramOrderEntry): void {
  const clean = String(entry.orderNumber || "").trim().toUpperCase();
  if (!clean || !entry.messageId) return;

  const cache = ensureCacheLoaded();
  const normalized: TelegramOrderEntry = {
    ...entry,
    orderNumber: clean,
    updatedAt: Date.now(),
  };

  cache.set(clean, normalized);
  flushCacheToDisk();
}

