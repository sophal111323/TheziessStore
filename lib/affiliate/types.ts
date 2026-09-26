export type AffiliateStatus = "ACTIVE" | "SUSPENDED";

export type CommissionType = "PERCENT" | "FIXED";

export interface Affiliate {
  id: string;
  name: string;
  displayName?: string;
  username: string;
  slug: string;
  email: string;
  phone?: string;
  telegram?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
  status: AffiliateStatus;
  commissionType: CommissionType;
  commissionRate: number; // e.g. 0.05 for 5%
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateStats {
  clicks: number;
  visitors: number;
  orders: number;
  successfulOrders: number;
  cancelledOrders: number;
  conversionRate: number; // in percentage e.g. 8.35
  totalSales: number;
  totalCommission: number;
  pendingCommission: number;
  availableBalance: number;
  paidCommission: number;
  totalAdjustmentsAdd?: number;
  totalAdjustmentsDeduct?: number;
}

export type AdjustmentType = "ADD" | "DEDUCT";

export interface AffiliateAdjustment {
  id: string;
  affiliateId: string;
  type: AdjustmentType;
  amountUsd: number;
  reason: string;
  adminEmail?: string;
  createdAt: string;
}

export type AffiliateOrderStatus = "COMPLETED" | "PENDING" | "CANCELLED";

export interface AffiliateOrder {
  id: string;
  orderNumber: string;
  affiliateId: string;
  affiliateSlug: string;
  gameName: string;
  gameSlug: string;
  productName: string;
  amountUsd: number;
  commissionRate: number;
  commissionUsd: number;
  status: AffiliateOrderStatus;
  createdAt: string;
}

export type PayoutMethod = "ABA" | "WING" | "ACLEDA" | "TRUE_MONEY" | "CASH" | "OTHER" | (string & {});
export type PayoutStatus = "PENDING" | "APPROVED" | "PAID" | "REJECTED";

export interface AffiliatePayout {
  id: string;
  affiliateId: string;
  amountUsd: number;
  paymentMethod: PayoutMethod;
  accountName: string;
  accountNumber: string;
  note?: string;
  status: PayoutStatus;
  createdAt: string;
  processedAt?: string;
}

export interface AffiliateNotification {
  id: string;
  affiliateId: string;
  title: string;
  message: string;
  type: "order" | "commission" | "payout" | "promo" | "info";
  read: boolean;
  createdAt: string;
}

export interface MarketingAsset {
  id: string;
  title: string;
  category: "banner" | "game" | "logo";
  imageUrl: string;
  captionKh: string;
  captionEn?: string;
}

export interface AffiliateSettings {
  registrationOpen: boolean;
  maxPromoters: number;
  closedMessageKh?: string;
  closedMessageEn?: string;
  updatedAt: string;
}

