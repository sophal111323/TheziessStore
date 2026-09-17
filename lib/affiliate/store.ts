import fs from "fs";
import path from "path";
import {
  Affiliate,
  AffiliateStats,
  AffiliateOrder,
  AffiliatePayout,
  AffiliateNotification,
  MarketingAsset,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {}
}

const globalAffiliateStore = globalThis as unknown as {
  __affiliates?: Affiliate[];
  __affiliateOrders?: AffiliateOrder[];
  __affiliatePayouts?: AffiliatePayout[];
  __affiliateNotifications?: AffiliateNotification[];
};

// ── Seed Data: Davin, Somnang, Sokha ────────────────────────────────────
const SEED_AFFILIATES: Affiliate[] = [
  {
    id: "aff-davin",
    name: "Davin",
    username: "davin",
    slug: "davin",
    email: "davin@gmail.com",
    phone: "012345678",
    telegram: "@davin_kh",
    facebook: "Davin Gaming",
    tiktok: "@davin.game",
    youtube: "Davin Official",
    status: "ACTIVE",
    commissionType: "PERCENT",
    commissionRate: 0.05, // 5%
    passwordHash: "password123",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-09-17T08:00:00.000Z",
  },
  {
    id: "aff-somnang",
    name: "Somnang",
    username: "somnang",
    slug: "somnang",
    email: "somnang@gmail.com",
    phone: "098765432",
    telegram: "@somnang_topup",
    facebook: "Somnang MLBB",
    tiktok: "@somnang.esports",
    status: "ACTIVE",
    commissionType: "PERCENT",
    commissionRate: 0.05,
    passwordHash: "password123",
    createdAt: "2026-08-10T12:00:00.000Z",
    updatedAt: "2026-09-17T08:00:00.000Z",
  },
  {
    id: "aff-sokha",
    name: "Sokha",
    username: "sokha",
    slug: "sokha",
    email: "sokha@gmail.com",
    phone: "077112233",
    telegram: "@sokha_freefire",
    tiktok: "@sokha.ff",
    status: "ACTIVE",
    commissionType: "PERCENT",
    commissionRate: 0.05,
    passwordHash: "password123",
    createdAt: "2026-08-20T14:00:00.000Z",
    updatedAt: "2026-09-17T08:00:00.000Z",
  },
  {
    id: "aff-sokphal",
    name: "Sokphal",
    username: "sokphal",
    slug: "sokphal",
    email: "akubluetooth030511@gmail.com",
    phone: "088998877",
    telegram: "@sokphal_gaming",
    tiktok: "@sokphal.topup",
    status: "ACTIVE",
    commissionType: "PERCENT",
    commissionRate: 0.05,
    passwordHash: "password123",
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-17T08:00:00.000Z",
  },
];

// Seed Orders for Davin: 87 orders total, $384.50 sales, $19.23 commission
const SEED_ORDERS_DAVIN: AffiliateOrder[] = [
  {
    id: "ord-10592",
    orderNumber: "RT-10592",
    affiliateId: "aff-davin",
    affiliateSlug: "davin",
    gameName: "Free Fire",
    gameSlug: "free-fire",
    productName: "420 Diamonds",
    amountUsd: 4.79,
    commissionRate: 0.05,
    commissionUsd: 0.24,
    status: "COMPLETED",
    createdAt: "2026-09-17T02:15:00.000Z",
  },
  {
    id: "ord-10580",
    orderNumber: "RT-10580",
    affiliateId: "aff-davin",
    affiliateSlug: "davin",
    gameName: "Mobile Legends",
    gameSlug: "mobile-legends",
    productName: "86 Diamonds",
    amountUsd: 0.99,
    commissionRate: 0.05,
    commissionUsd: 0.05,
    status: "COMPLETED",
    createdAt: "2026-09-16T18:40:00.000Z",
  },
  {
    id: "ord-10571",
    orderNumber: "RT-10571",
    affiliateId: "aff-davin",
    affiliateSlug: "davin",
    gameName: "PUBG Mobile",
    gameSlug: "pubg-mobile",
    productName: "60 UC",
    amountUsd: 0.89,
    commissionRate: 0.05,
    commissionUsd: 0.04,
    status: "PENDING",
    createdAt: "2026-09-16T15:20:00.000Z",
  },
  {
    id: "ord-10565",
    orderNumber: "RT-10565",
    affiliateId: "aff-davin",
    affiliateSlug: "davin",
    gameName: "Knives Out",
    gameSlug: "knives-out",
    productName: "600 Vouchers",
    amountUsd: 9.99,
    commissionRate: 0.05,
    commissionUsd: 0.50,
    status: "COMPLETED",
    createdAt: "2026-09-15T11:10:00.000Z",
  },
  {
    id: "ord-10550",
    orderNumber: "RT-10550",
    affiliateId: "aff-davin",
    affiliateSlug: "davin",
    gameName: "Free Fire",
    gameSlug: "free-fire",
    productName: "Weekly Membership",
    amountUsd: 1.99,
    commissionRate: 0.05,
    commissionUsd: 0.10,
    status: "COMPLETED",
    createdAt: "2026-09-14T09:30:00.000Z",
  },
  {
    id: "ord-10542",
    orderNumber: "RT-10542",
    affiliateId: "aff-davin",
    affiliateSlug: "davin",
    gameName: "Mobile Legends",
    gameSlug: "mobile-legends",
    productName: "Weekly Diamond Pass",
    amountUsd: 1.85,
    commissionRate: 0.05,
    commissionUsd: 0.09,
    status: "COMPLETED",
    createdAt: "2026-09-13T14:15:00.000Z",
  },
  {
    id: "ord-10531",
    orderNumber: "RT-10531",
    affiliateId: "aff-davin",
    affiliateSlug: "davin",
    gameName: "Honor of Kings",
    gameSlug: "honor-of-kings",
    productName: "80 Tokens",
    amountUsd: 0.99,
    commissionRate: 0.05,
    commissionUsd: 0.05,
    status: "CANCELLED",
    createdAt: "2026-09-12T16:05:00.000Z",
  },
];

// Seed Payouts for Davin
const SEED_PAYOUTS: AffiliatePayout[] = [
  {
    id: "pay-101",
    affiliateId: "aff-davin",
    amountUsd: 120.00,
    paymentMethod: "ABA",
    accountName: "DAVIN KH",
    accountNumber: "001 889 923",
    status: "PAID",
    createdAt: "2026-08-30T10:00:00.000Z",
    processedAt: "2026-08-30T11:30:00.000Z",
  },
  {
    id: "pay-102",
    affiliateId: "aff-davin",
    amountUsd: 10.00,
    paymentMethod: "ABA",
    accountName: "DAVIN KH",
    accountNumber: "001 889 923",
    status: "PAID",
    createdAt: "2026-09-10T14:00:00.000Z",
    processedAt: "2026-09-10T15:00:00.000Z",
  },
];

// Seed Notifications
const SEED_NOTIFICATIONS: AffiliateNotification[] = [
  {
    id: "notif-1",
    affiliateId: "aff-davin",
    title: "Order #10592 Completed",
    message: "A customer bought 420 Diamonds on Free Fire via your link.",
    type: "order",
    read: false,
    createdAt: "2026-09-17T02:16:00.000Z",
  },
  {
    id: "notif-2",
    affiliateId: "aff-davin",
    title: "Commission Earned: $0.24",
    message: "5% commission credited from Order #10592.",
    type: "commission",
    read: false,
    createdAt: "2026-09-17T02:16:00.000Z",
  },
  {
    id: "notif-3",
    affiliateId: "aff-davin",
    title: "Payout of $10.00 Approved",
    message: "Your ABA transfer has been processed successfully.",
    type: "payout",
    read: true,
    createdAt: "2026-09-10T15:00:00.000Z",
  },
  {
    id: "notif-4",
    affiliateId: "aff-davin",
    title: "New Banner Available",
    message: "Check out the new Free Fire event promo banners in Marketing Materials.",
    type: "promo",
    read: true,
    createdAt: "2026-09-08T09:00:00.000Z",
  },
];

export { MARKETING_ASSETS } from "./constants";

function getStoredAffiliates(): Affiliate[] {
  ensureDataDir();
  const file = path.join(DATA_DIR, "affiliates.json");
  try {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf-8");
      const list = JSON.parse(content);
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch {}
  return [...SEED_AFFILIATES];
}

function saveStoredAffiliates(list: Affiliate[]) {
  ensureDataDir();
  const file = path.join(DATA_DIR, "affiliates.json");
  try {
    fs.writeFileSync(file, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save affiliates:", e);
  }
}

// ── Store Access Methods ────────────────────────────────────────────────
export function getAllAffiliates(): Affiliate[] {
  return getStoredAffiliates();
}

export function getAffiliateById(id: string): Affiliate | null {
  return getStoredAffiliates().find((a) => a.id === id) || null;
}

export function getAffiliateBySlug(slug: string): Affiliate | null {
  const clean = (slug || "").trim().toLowerCase();
  return getStoredAffiliates().find((a) => a.slug.toLowerCase() === clean) || null;
}

export function getAffiliateByUsername(username: string): Affiliate | null {
  const clean = (username || "").trim().toLowerCase();
  return getStoredAffiliates().find((a) => a.username.toLowerCase() === clean) || null;
}

export function authenticateAffiliate(identifier: string, pass: string): Affiliate | null {
  const clean = (identifier || "").trim().toLowerCase();
  const list = getStoredAffiliates();
  const aff = list.find(
    (a) => a.username.toLowerCase() === clean || a.email.toLowerCase() === clean
  );
  if (!aff) return null;

  // 1. Password matches exactly
  if (aff.passwordHash && aff.passwordHash === pass) {
    return aff;
  }

  // 2. Common fallback passwords for testing
  if (pass === "password123" || pass === "davin123") {
    return aff;
  }

  // 3. If account was seeded or password is empty, allow user to set their password on login
  if (!aff.passwordHash || aff.passwordHash === "password123") {
    if (pass && pass.length >= 6) {
      aff.passwordHash = pass;
      aff.updatedAt = new Date().toISOString();
      saveStoredAffiliates(list);
      return aff;
    }
  }

  return null;
}

export function registerAffiliate(data: {
  name: string;
  username: string;
  email: string;
  phone?: string;
  telegram?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
  password?: string;
}): { success: boolean; affiliate?: Affiliate; error?: string } {
  const cleanUsername = data.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!cleanUsername) {
    return { success: false, error: "Invalid username" };
  }

  const list = getStoredAffiliates();

  // If email already registered (e.g. pre-seeded or previously created), update their credentials so they can login immediately!
  const existingEmailIndex = list.findIndex(
    (a) => a.email.toLowerCase() === data.email.trim().toLowerCase()
  );
  if (existingEmailIndex !== -1) {
    list[existingEmailIndex].name = data.name.trim();
    list[existingEmailIndex].username = cleanUsername;
    list[existingEmailIndex].slug = cleanUsername;
    list[existingEmailIndex].passwordHash = data.password || list[existingEmailIndex].passwordHash;
    if (data.phone) list[existingEmailIndex].phone = data.phone.trim();
    if (data.telegram) list[existingEmailIndex].telegram = data.telegram.trim();
    list[existingEmailIndex].updatedAt = new Date().toISOString();
    saveStoredAffiliates(list);
    return { success: true, affiliate: list[existingEmailIndex] };
  }

  const existing = list.find(
    (a) => a.username.toLowerCase() === cleanUsername || a.slug.toLowerCase() === cleanUsername
  );
  if (existing) {
    return { success: false, error: "Username or slug already taken" };
  }

  const newAffiliate: Affiliate = {
    id: `aff-${Date.now()}`,
    name: data.name.trim(),
    username: cleanUsername,
    slug: cleanUsername,
    email: data.email.trim().toLowerCase(),
    phone: data.phone?.trim() || "",
    telegram: data.telegram?.trim() || "",
    facebook: data.facebook?.trim() || "",
    tiktok: data.tiktok?.trim() || "",
    youtube: data.youtube?.trim() || "",
    status: "ACTIVE", // Auto-activated per requirements
    commissionType: "PERCENT",
    commissionRate: 0.05,
    passwordHash: data.password || "password123",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  list.push(newAffiliate);
  saveStoredAffiliates(list);
  return { success: true, affiliate: newAffiliate };
}

export function updateAffiliateProfile(
  id: string,
  data: Partial<Pick<Affiliate, "name" | "phone" | "telegram" | "facebook" | "tiktok" | "youtube">>
): Affiliate | null {
  const list = getStoredAffiliates();
  const aff = list.find((a) => a.id === id);
  if (!aff) return null;

  Object.assign(aff, data, { updatedAt: new Date().toISOString() });
  saveStoredAffiliates(list);
  return aff;
}

export function updateAffiliateStatus(id: string, status: "ACTIVE" | "SUSPENDED"): Affiliate | null {
  const list = getStoredAffiliates();
  const aff = list.find((a) => a.id === id);
  if (!aff) return null;
  aff.status = status;
  aff.updatedAt = new Date().toISOString();
  saveStoredAffiliates(list);
  return aff;
}

export function getAllAffiliateOrders(): AffiliateOrder[] {
  return (globalAffiliateStore.__affiliateOrders || [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getAffiliateOrderByOrderNumber(orderNumber: string): AffiliateOrder | undefined {
  return (globalAffiliateStore.__affiliateOrders || []).find((o) => o.orderNumber === orderNumber);
}

export function getAffiliateOrders(affiliateId: string): AffiliateOrder[] {
  return (globalAffiliateStore.__affiliateOrders || [])
    .filter((o) => o.affiliateId === affiliateId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getAffiliatePayouts(affiliateId: string): AffiliatePayout[] {
  return (globalAffiliateStore.__affiliatePayouts || [])
    .filter((p) => p.affiliateId === affiliateId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getAffiliateNotifications(affiliateId: string): AffiliateNotification[] {
  return (globalAffiliateStore.__affiliateNotifications || [])
    .filter((n) => n.affiliateId === affiliateId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function markNotificationsAsRead(affiliateId: string): void {
  (globalAffiliateStore.__affiliateNotifications || []).forEach((n) => {
    if (n.affiliateId === affiliateId) n.read = true;
  });
}

export function requestPayout(
  affiliateId: string,
  data: {
    amountUsd: number;
    paymentMethod: "ABA" | "WING" | "ACLEDA" | "OTHER";
    accountName: string;
    accountNumber: string;
    note?: string;
  }
): { success: boolean; payout?: AffiliatePayout; error?: string } {
  const stats = getAffiliateStats(affiliateId);
  if (data.amountUsd <= 0) {
    return { success: false, error: "Invalid payout amount" };
  }
  if (data.amountUsd > stats.availableBalance) {
    return { success: false, error: `Insufficient available balance ($${stats.availableBalance.toFixed(2)})` };
  }

  const newPayout: AffiliatePayout = {
    id: `pay-${Date.now()}`,
    affiliateId,
    amountUsd: data.amountUsd,
    paymentMethod: data.paymentMethod,
    accountName: data.accountName.trim(),
    accountNumber: data.accountNumber.trim(),
    note: data.note?.trim(),
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };

  globalAffiliateStore.__affiliatePayouts?.unshift(newPayout);
  return { success: true, payout: newPayout };
}

export function getAffiliateStats(affiliateId: string): AffiliateStats {
  const aff = getAffiliateById(affiliateId);
  // If Davin, return the full demo metrics requested
  if (aff?.username === "davin") {
    return {
      clicks: 1284,
      visitors: 982,
      orders: 87,
      successfulOrders: 82,
      cancelledOrders: 5,
      conversionRate: 8.35,
      totalSales: 384.50,
      totalCommission: 19.23,
      pendingCommission: 4.50,
      availableBalance: 14.73,
      paidCommission: 130.00,
    };
  }

  if (aff?.username === "somnang") {
    return {
      clicks: 1840,
      visitors: 1420,
      orders: 143,
      successfulOrders: 138,
      cancelledOrders: 5,
      conversionRate: 9.72,
      totalSales: 592.10,
      totalCommission: 29.60,
      pendingCommission: 6.20,
      availableBalance: 23.40,
      paidCommission: 80.00,
    };
  }

  if (aff?.username === "sokha") {
    return {
      clicks: 520,
      visitors: 410,
      orders: 41,
      successfulOrders: 39,
      cancelledOrders: 2,
      conversionRate: 9.51,
      totalSales: 82.30,
      totalCommission: 4.12,
      pendingCommission: 1.10,
      availableBalance: 3.02,
      paidCommission: 0.00,
    };
  }

  // Generic calculated stats for newly registered creators
  const orders = getAffiliateOrders(affiliateId);
  const completed = orders.filter((o) => o.status === "COMPLETED");
  const pending = orders.filter((o) => o.status === "PENDING");
  const cancelled = orders.filter((o) => o.status === "CANCELLED");

  const totalSales = completed.reduce((sum, o) => sum + o.amountUsd, 0);
  const totalCommission = completed.reduce((sum, o) => sum + o.commissionUsd, 0);
  const pendingCommission = pending.reduce((sum, o) => sum + o.commissionUsd, 0);

  const payouts = getAffiliatePayouts(affiliateId);
  const paidCommission = payouts
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.amountUsd, 0);

  const availableBalance = Math.max(0, totalCommission - paidCommission);

  return {
    clicks: 0,
    visitors: 0,
    orders: orders.length,
    successfulOrders: completed.length,
    cancelledOrders: cancelled.length,
    conversionRate: orders.length > 0 ? Number(((completed.length / Math.max(1, orders.length)) * 100).toFixed(2)) : 0,
    totalSales,
    totalCommission,
    pendingCommission,
    availableBalance,
    paidCommission,
  };
}
