import { describe, expect, it } from "vitest";
import {
  amountsMatch,
  buildRemoteSnapshotForValidation,
  isRemotePaid,
  validatePaymentForOrder,
  type OrderPaymentSnapshot,
} from "@/lib/payment-validation";

const order: OrderPaymentSnapshot = {
  id: "order-id",
  orderNumber: "ORD-1001",
  paymentRef: "PAY-ABC",
  amountUsd: 1.5,
  currency: "USD",
  status: "PENDING",
};

const goodRemote = {
  orderNumber: "ORD-1001",
  transactionId: "PAY-ABC",
  amount: "1.50",
  currency: "usd",
  status: "PAID",
  paid: true,
};

describe("amountsMatch", () => {
  it("matches within the default 0.01 tolerance", () => {
    expect(amountsMatch(1.5, 1.5)).toBe(true);
    expect(amountsMatch(1.5, 1.505)).toBe(true);
    expect(amountsMatch(1.5, 1.495)).toBe(true);
    expect(amountsMatch(1.5, 1.51, 0.02)).toBe(true);
    expect(amountsMatch(1.5, 1.52)).toBe(false);
    expect(amountsMatch(1.5, 0.01)).toBe(false);
  });

  it("parses strings, including thousands separators", () => {
    expect(amountsMatch("1,250.00", 1250)).toBe(true);
    expect(amountsMatch(" 2.00 ", "2")).toBe(true);
  });

  it("rejects NaN, empty, missing and non-numeric values", () => {
    expect(amountsMatch(1.5, Number.NaN)).toBe(false);
    expect(amountsMatch(Number.NaN, Number.NaN)).toBe(false);
    expect(amountsMatch(1.5, Number.POSITIVE_INFINITY)).toBe(false);
    expect(amountsMatch(1.5, "")).toBe(false);
    expect(amountsMatch(1.5, "abc")).toBe(false);
    expect(amountsMatch(1.5, null)).toBe(false);
    expect(amountsMatch(1.5, undefined)).toBe(false);
  });
});

describe("isRemotePaid", () => {
  it.each(["Paid", "PAID", "paid", "approved", "completed"])("treats %s as paid", (status) => {
    expect(isRemotePaid({ status })).toBe(true);
  });

  it.each(["UnderPaid", "expired", "failed", "Pending", "cancelled", ""])(
    "treats %j as not paid",
    (status) => {
      expect(isRemotePaid({ status })).toBe(false);
    }
  );

  it("accepts paid:true but a failure word still wins", () => {
    expect(isRemotePaid({ status: "PENDING", paid: true })).toBe(true);
    expect(isRemotePaid({ status: "FAILED", paid: true })).toBe(false);
  });

  it("is false for null/undefined", () => {
    expect(isRemotePaid(null)).toBe(false);
    expect(isRemotePaid(undefined)).toBe(false);
  });
});

describe("validatePaymentForOrder", () => {
  it("accepts a matching payment", () => {
    const result = validatePaymentForOrder(order, goodRemote);
    expect(result).toMatchObject({
      ok: true,
      transactionId: "PAY-ABC",
      amount: 1.5,
      currency: "USD",
      orderNumber: "ORD-1001",
    });
  });

  it.each([
    ["ORDER_NUMBER_MISMATCH", order, { ...goodRemote, orderNumber: "ORD-9999" }],
    ["MISSING_TRANSACTION_ID", order, { ...goodRemote, transactionId: "" }],
    ["MISSING_ORDER_PAYMENT_REF", { ...order, paymentRef: null }, goodRemote],
    ["TRANSACTION_ID_MISMATCH", order, { ...goodRemote, transactionId: "PAY-OTHER" }],
    ["MISSING_REMOTE_AMOUNT", order, { ...goodRemote, amount: undefined }],
    ["MISSING_REMOTE_AMOUNT", order, { ...goodRemote, amount: "NaN" }],
    ["AMOUNT_MISMATCH", order, { ...goodRemote, amount: "0.01" }],
    ["MISSING_REMOTE_CURRENCY", order, { ...goodRemote, currency: "" }],
    ["CURRENCY_MISMATCH", order, { ...goodRemote, currency: "KHR" }],
  ] as const)("fails with %s", (code, o, remote) => {
    const result = validatePaymentForOrder(o, remote);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(code);
  });
});

describe("buildRemoteSnapshotForValidation", () => {
  const jlaOrder = {
    ...order,
    paymentRef: "178392699651531",
    paymentProvider: "jla",
  };

  it("jla: binds to the stored paymentRef when the echoed tran_id matches", () => {
    const snapshot = buildRemoteSnapshotForValidation(jlaOrder, {
      status: "PAID",
      paid: true,
      orderNumber: "ORD-1001",
      transactionId: "ORD-1001",
      amount: "1.50",
      currency: "USD",
      provider: "jla",
    });
    expect(snapshot.transactionId).toBe(jlaOrder.paymentRef);
    expect(validatePaymentForOrder(jlaOrder, snapshot).ok).toBe(true);
  });

  it("jla: a different echoed tran_id keeps the remote id and fails validation", () => {
    const snapshot = buildRemoteSnapshotForValidation(jlaOrder, {
      status: "PAID",
      paid: true,
      orderNumber: "ORD-2002",
      transactionId: "999",
      amount: "1.50",
      currency: "USD",
    });
    expect(snapshot.transactionId).toBe("999");
    const result = validatePaymentForOrder(jlaOrder, snapshot);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ORDER_NUMBER_MISMATCH");
  });

  it("jla: binds when only the echoed Payway id matches the stored paymentRef", () => {
    const snapshot = buildRemoteSnapshotForValidation(jlaOrder, {
      status: "PAID",
      paid: true,
      transactionId: jlaOrder.paymentRef,
      amount: "1.50",
      currency: "USD",
    });
    expect(validatePaymentForOrder(jlaOrder, snapshot).ok).toBe(true);
  });

  it("jla: an echoed Payway id for another payment fails (R-5)", () => {
    const snapshot = buildRemoteSnapshotForValidation(jlaOrder, {
      status: "PAID",
      paid: true,
      orderNumber: "ORD-1001",
      transactionId: "555000111",
      amount: "1.50",
      currency: "USD",
      queryId: "ORD-1001",
    });
    const result = validatePaymentForOrder(jlaOrder, snapshot);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TRANSACTION_ID_MISMATCH");
  });

  it("jla: an echoed currency must match the order (R-5)", () => {
    const snapshot = buildRemoteSnapshotForValidation(jlaOrder, {
      status: "PAID",
      paid: true,
      orderNumber: "ORD-1001",
      amount: "1.50",
      currency: "KHR",
    });
    const result = validatePaymentForOrder(jlaOrder, snapshot);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CURRENCY_MISMATCH");
  });

  it("jla: nothing echoed falls back to the query id, amount and order currency", () => {
    const snapshot = buildRemoteSnapshotForValidation(jlaOrder, {
      status: "PAID",
      paid: true,
      amount: "1.50",
      queryId: "ORD-1001",
    });
    expect(snapshot).toMatchObject({ transactionId: jlaOrder.paymentRef, currency: "USD" });
    expect(validatePaymentForOrder(jlaOrder, snapshot).ok).toBe(true);

    const wrongAmount = buildRemoteSnapshotForValidation(jlaOrder, {
      status: "PAID",
      paid: true,
      amount: "0.10",
      queryId: "ORD-1001",
    });
    const result = validatePaymentForOrder(jlaOrder, wrongAmount);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AMOUNT_MISMATCH");
  });

  it("jla: nothing echoed and not queried by this order fails", () => {
    for (const queryId of [undefined, "ORD-2002"]) {
      const snapshot = buildRemoteSnapshotForValidation(jlaOrder, {
        status: "PAID",
        paid: true,
        amount: "1.50",
        currency: "USD",
        queryId,
      });
      const result = validatePaymentForOrder(jlaOrder, snapshot);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("MISSING_TRANSACTION_ID");
    }
  });

  it("jla: still checks the remote amount", () => {
    const snapshot = buildRemoteSnapshotForValidation(jlaOrder, {
      status: "PAID",
      paid: true,
      orderNumber: "ORD-1001",
      amount: "0.10",
      currency: "USD",
    });
    const result = validatePaymentForOrder(jlaOrder, snapshot);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AMOUNT_MISMATCH");
  });

  it("khqrpay: uses the remote payment id, falls back to paymentRef", () => {
    const khqrOrder = { ...order, paymentProvider: "khqrpay" };
    const remote = { status: "PAID", paid: true, amount: "1.50", currency: "USD" };

    const withId = buildRemoteSnapshotForValidation(khqrOrder, { ...remote, transactionId: "PAY-ABC" });
    expect(withId).toMatchObject({ orderNumber: "ORD-1001", transactionId: "PAY-ABC" });
    expect(validatePaymentForOrder(khqrOrder, withId).ok).toBe(true);

    const otherId = buildRemoteSnapshotForValidation(khqrOrder, { ...remote, transactionId: "PAY-OTHER" });
    const result = validatePaymentForOrder(khqrOrder, otherId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TRANSACTION_ID_MISMATCH");

    const noId = buildRemoteSnapshotForValidation(khqrOrder, remote);
    expect(noId.transactionId).toBe("PAY-ABC");
  });
});
