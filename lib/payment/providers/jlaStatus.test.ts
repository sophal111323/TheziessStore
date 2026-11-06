import { describe, expect, it } from "vitest";
import { parseJlaStatusResponse } from "@/lib/payment/providers/jlaStatus";
import { buildRemoteSnapshotForValidation, validatePaymentForOrder } from "@/lib/payment-validation";

const order = {
  id: "o1",
  orderNumber: "ORD-1001",
  paymentRef: "178392699651531",
  paymentProvider: "jla",
  amountUsd: 1.5,
  currency: "USD",
  status: "PENDING",
};

function confirm(data: unknown) {
  const parsed = parseJlaStatusResponse(data, order.orderNumber);
  if (!parsed) throw new Error("unparsed");
  return {
    parsed,
    validation: validatePaymentForOrder(order, buildRemoteSnapshotForValidation(order, parsed.result)),
  };
}

describe("parseJlaStatusResponse (R-5)", () => {
  it("documented approval: status.message approved, Payway id in status.tran_id", () => {
    const { parsed, validation } = confirm({
      status: { code: "00", message: "approved", tran_id: "178392699651531" },
      data: { total_amount: "1.50" },
    });
    expect(parsed.result).toMatchObject({ paid: true, status: "PAID", transactionId: "178392699651531" });
    expect(parsed.result.orderNumber).toBeUndefined();
    expect(parsed.result.currency).toBeUndefined();
    expect(parsed.missing.currency).toBe(true);
    expect(validation.ok).toBe(true);
  });

  it("documented approval: data.action approved with echoed tran_id and currency", () => {
    const { parsed, validation } = confirm({
      tran_id: "ORD-1001",
      amount: "1.50",
      currency: "usd",
      data: { action: "approved" },
    });
    expect(parsed.result).toMatchObject({ paid: true, orderNumber: "ORD-1001", currency: "USD" });
    expect(validation.ok).toBe(true);
  });

  it("ABA-style data.payment_status / payment_currency", () => {
    const { parsed, validation } = confirm({
      status: { code: "00", message: "Success!", tran_id: "ORD-1001" },
      data: { payment_status: "APPROVED", total_amount: 1.5, payment_currency: "USD" },
    });
    expect(parsed.result).toMatchObject({ paid: true, orderNumber: "ORD-1001", currency: "USD" });
    expect(parsed.result.transactionId).toBeUndefined();
    expect(validation.ok).toBe(true);
  });

  it("status.code 00 alone is not a payment approval", () => {
    const { parsed, validation } = confirm({
      status: { code: "00", message: "Success!", tran_id: "178392699651531" },
      data: { total_amount: "1.50" },
    });
    expect(parsed.result.paid).toBe(false);
    expect(parsed.result.status).toBe("PENDING");
    expect(parsed.statusCodeOnly).toBe(true);
    expect(validation.ok).toBe(true); // binding fine, but isRemotePaid stays false
  });

  it("pending ABA status with code 00 stays pending", () => {
    const { parsed } = confirm({
      status: { code: "00", message: "Success!" },
      data: { payment_status: "PENDING", total_amount: "1.50" },
    });
    expect(parsed.result.paid).toBe(false);
    expect(parsed.statusCodeOnly).toBe(false);
  });

  it("a failure word wins over an approval word", () => {
    const { parsed } = confirm({ status: { message: "approved" }, data: { payment_status: "DECLINED" } });
    expect(parsed.result).toMatchObject({ paid: false, status: "FAILED" });
  });

  it("expired is reported as EXPIRED", () => {
    const { parsed } = confirm({ status: "expired" });
    expect(parsed.result).toMatchObject({ paid: false, status: "EXPIRED" });
  });

  it("echoed ids or currency for another payment fail validation", () => {
    const otherOrder = confirm({ tran_id: "ORD-9999", status: "approved", amount: "1.50", currency: "USD" });
    expect(otherOrder.validation.ok).toBe(false);
    if (!otherOrder.validation.ok) expect(otherOrder.validation.code).toBe("ORDER_NUMBER_MISMATCH");

    const otherPayway = confirm({ payway_tran_id: "999", status: "approved", amount: "1.50" });
    expect(otherPayway.validation.ok).toBe(false);
    if (!otherPayway.validation.ok) expect(otherPayway.validation.code).toBe("TRANSACTION_ID_MISMATCH");

    const otherCurrency = confirm({ tran_id: "ORD-1001", status: "approved", amount: "1.50", currency: "KHR" });
    expect(otherCurrency.validation.ok).toBe(false);
    if (!otherCurrency.validation.ok) expect(otherCurrency.validation.code).toBe("CURRENCY_MISMATCH");
  });

  it("non-object input returns null", () => {
    expect(parseJlaStatusResponse(null, "ORD-1001")).toBeNull();
    expect(parseJlaStatusResponse("x", "ORD-1001")).toBeNull();
  });
});
