// lib/payment/types.ts
//
// Shared payment provider types. Provider-specific details live in
// lib/payment/providers/* — the rest of the app only uses these shapes.

export type PaymentMethod =
  | "TOLASAINT"
  | "MANUAL"
  | "ABA"
  | "ACLEDA"
  | "WING"
  | "KHQR"
  | "KHQRPAY";

export type PaymentProviderType = "khqrpay" | "jla";

export interface InitiatePaymentArgs {
  orderNumber: string;
  amountUsd: number;
  /** Order currency — server-loaded from the DB, never from the browser. */
  currency?: string;
  method: PaymentMethod;
  returnUrl: string;
  cancelUrl: string;
  callbackUrl: string;
  note?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface PaymentInitResult {
  paymentRef: string;
  redirectUrl: string;
  qrString?: string;
  deeplink?: string;
  expiresAt: Date;
  provider?: PaymentProviderType;
}

export type PaymentStatusResult = {
  status: string;
  paid: boolean;
  transactionId?: string;
  orderNumber?: string;
  amount?: string;
  currency?: string;
  provider?: PaymentProviderType;
};

export interface NormalizedWebhookEvent {
  event: string;
  orderNumber?: string;
  transactionId: string;
  status: "paid" | "expired" | "failed" | "pending";
  amount?: string;
  currency?: string;
  rawPayload?: any;
}

export interface IPaymentProvider {
  readonly name: PaymentProviderType;
  initiatePayment(args: InitiatePaymentArgs): Promise<PaymentInitResult>;
  fetchStatus(transactionId: string): Promise<PaymentStatusResult | null>;
  verifyWebhook(rawBody: string, headers: Record<string, string>): boolean;
  parseWebhookEvent(payload: any): NormalizedWebhookEvent | null;
}
