// scripts/test-payment-system.ts
import { PrismaClient } from "@prisma/client";
import {
  getActivePaymentProvider,
  initiatePayment,
  fetchPaymentStatus,
  invalidatePaymentProviderCache,
} from "../lib/payment";
import { parseJlaWebhookEvent } from "../lib/payment/providers/jla";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=== STARTING PAYMENT PROVIDER VERIFICATION SUITE ===");

  const timestamp = Date.now();
  const orderNumA = `TEST-A-${timestamp}`;
  const orderNumB = `TEST-B-${timestamp}`;
  const orderNumC = `TEST-C-${timestamp}`;

  // Find an existing game and product
  const testProduct = await prisma.product.findFirst({
    include: { game: true },
  });

  if (!testProduct) {
    throw new Error("No product found in DB to run payment tests against.");
  }
  const testGame = testProduct.game;

  // Ensure settings record exists
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({
      data: {
        siteName: "TheziessStore",
        paymentProvider: "khqrpay",
      },
    });
  }

  try {
    // ----------------------------------------------------
    // TEST 1: Admin selects KHQRPay -> Create Order A
    // ----------------------------------------------------
    console.log("\n[TEST 1] Testing KHQRPay provider...");
    await prisma.settings.update({
      where: { id: settings.id },
      data: { paymentProvider: "khqrpay" },
    });
    invalidatePaymentProviderCache();

    const activeProvider1 = await getActivePaymentProvider();
    console.log(`- Active provider in DB/cache: ${activeProvider1}`);
    if (activeProvider1 !== "khqrpay") {
      throw new Error(`Expected active provider to be 'khqrpay', got: ${activeProvider1}`);
    }

    const orderA = await prisma.order.create({
      data: {
        orderNumber: orderNumA,
        gameId: testGame.id,
        productId: testProduct.id,
        playerUid: "123456",
        amountUsd: 0.10,
        currency: "USD",
        paymentMethod: "KHQR",
        paymentProvider: activeProvider1,
        status: "PENDING",
      },
    });
    console.log(`- Order A created: ${orderA.orderNumber}, paymentProvider: ${orderA.paymentProvider}`);
    if (orderA.paymentProvider !== "khqrpay") {
      throw new Error(`Order A payment_provider must be 'khqrpay', got ${orderA.paymentProvider}`);
    }

    // Initiate payment for Order A
    const initA = await initiatePayment({
      orderNumber: orderA.orderNumber,
      amountUsd: orderA.amountUsd,
      currency: "USD",
      method: "KHQR",
      returnUrl: `https://theziessstore.store/checkout/${orderA.orderNumber}`,
      cancelUrl: `https://theziessstore.store/checkout/${orderA.orderNumber}`,
      callbackUrl: "https://theziessstore.store/api/payment/webhook/khqrpay",
    }, orderA.paymentProvider as "khqrpay");
    console.log(`- Order A initiatePayment success: provider=${initA.provider}, qrStringLength=${initA.qrString?.length}`);
    if (initA.provider !== "khqrpay") {
      throw new Error(`Expected Order A init provider to be 'khqrpay', got ${initA.provider}`);
    }

    // ----------------------------------------------------
    // TEST 2: Admin switches to JLA Payway -> Create Order B
    // ----------------------------------------------------
    console.log("\n[TEST 2] Testing JLA Payway provider...");
    await prisma.settings.update({
      where: { id: settings.id },
      data: { paymentProvider: "jla" },
    });
    // Create audit log for provider switch
    await prisma.auditLog.create({
      data: {
        action: "settings.payment_provider_switch",
        adminEmail: "admin@test.local",
        ipAddress: "127.0.0.1",
        userAgent: "Verification-Suite",
        details: "KHQRPay → JLA",
      },
    });
    invalidatePaymentProviderCache();

    const activeProvider2 = await getActivePaymentProvider();
    console.log(`- Active provider in DB/cache: ${activeProvider2}`);
    if (activeProvider2 !== "jla") {
      throw new Error(`Expected active provider to be 'jla', got: ${activeProvider2}`);
    }

    const orderB = await prisma.order.create({
      data: {
        orderNumber: orderNumB,
        gameId: testGame.id,
        productId: testProduct.id,
        playerUid: "123456",
        amountUsd: 0.10,
        currency: "USD",
        paymentMethod: "KHQR",
        paymentProvider: activeProvider2,
        status: "PENDING",
      },
    });
    console.log(`- Order B created: ${orderB.orderNumber}, paymentProvider: ${orderB.paymentProvider}`);
    if (orderB.paymentProvider !== "jla") {
      throw new Error(`Order B payment_provider must be 'jla', got ${orderB.paymentProvider}`);
    }

    // Initiate payment for Order B (calls https://payway.jlastore.com/api/create-tran)
    const initB = await initiatePayment({
      orderNumber: orderB.orderNumber,
      amountUsd: orderB.amountUsd,
      currency: "USD",
      method: "KHQR",
      returnUrl: `https://theziessstore.store/checkout/${orderB.orderNumber}`,
      cancelUrl: `https://theziessstore.store/checkout/${orderB.orderNumber}`,
      callbackUrl: "https://theziessstore.store/api/payment/webhook/jla",
    }, orderB.paymentProvider as "jla");
    console.log(`- Order B initiatePayment result: provider=${initB.provider}, paymentRef=${initB.paymentRef}`);
    console.log(`- Order B qrString present: ${Boolean(initB.qrString)} (length: ${initB.qrString?.length || 0})`);
    console.log(`- Order B deeplink: ${initB.deeplink || "(none)"}`);

    if (initB.provider !== "jla") {
      throw new Error(`Expected Order B init provider to be 'jla', got ${initB.provider}`);
    }
    if (!initB.qrString) {
      throw new Error("JLA did not return a valid qrString");
    }
    if (!initB.deeplink) {
      console.warn("Notice: JLA did not return a deeplink string (check payway configuration)");
    } else {
      console.log("✓ JLA returned valid deeplink for ABA button!");
    }

    // Update order B with payment details
    await prisma.order.update({
      where: { id: orderB.id },
      data: {
        paymentRef: initB.paymentRef,
        deeplink: initB.deeplink ?? null,
      },
    });

    // Test JLA status check
    const statusB = await fetchPaymentStatus(initB.paymentRef, "jla");
    console.log(`- Order B JLA status check: status=${statusB.status}, provider=${statusB.provider}`);

    // Test JLA webhook parser
    const webhookSample = {
      status: "approved",
      tran_id: orderB.orderNumber,
      payway_tran_id: "JLA-PAYWAY-12345",
      amount: "0.10",
      date: new Date().toISOString(),
      download_receipt: "https://payway.jlastore.com/receipt/123",
    };
    const parsedEvent = parseJlaWebhookEvent(webhookSample);
    console.log(`- JLA webhook parse test: orderNumber=${parsedEvent.orderNumber}, transactionId=${parsedEvent.transactionId}, status=${parsedEvent.status}`);
    if (parsedEvent.orderNumber !== orderB.orderNumber || parsedEvent.status !== "paid") {
      throw new Error("JLA webhook event parsing failed");
    }

    // ----------------------------------------------------
    // TEST 3: Admin switches back to KHQRPay -> Create Order C
    // ----------------------------------------------------
    console.log("\n[TEST 3] Testing switch back: JLA -> KHQRPay...");
    await prisma.settings.update({
      where: { id: settings.id },
      data: { paymentProvider: "khqrpay" },
    });
    await prisma.auditLog.create({
      data: {
        action: "settings.payment_provider_switch",
        adminEmail: "admin@test.local",
        ipAddress: "127.0.0.1",
        userAgent: "Verification-Suite",
        details: "JLA → KHQRPay",
      },
    });
    invalidatePaymentProviderCache();

    const activeProvider3 = await getActivePaymentProvider();
    console.log(`- Active provider in DB/cache: ${activeProvider3}`);
    if (activeProvider3 !== "khqrpay") {
      throw new Error(`Expected active provider to be 'khqrpay', got: ${activeProvider3}`);
    }

    const orderC = await prisma.order.create({
      data: {
        orderNumber: orderNumC,
        gameId: testGame.id,
        productId: testProduct.id,
        playerUid: "123456",
        amountUsd: 0.10,
        currency: "USD",
        paymentMethod: "KHQR",
        paymentProvider: activeProvider3,
        status: "PENDING",
      },
    });
    console.log(`- Order C created: ${orderC.orderNumber}, paymentProvider: ${orderC.paymentProvider}`);
    if (orderC.paymentProvider !== "khqrpay") {
      throw new Error(`Order C payment_provider must be 'khqrpay', got ${orderC.paymentProvider}`);
    }

    // ----------------------------------------------------
    // VERIFY HISTORICAL ORDERS RETENTION
    // ----------------------------------------------------
    console.log("\n[VERIFICATION] Checking that previous orders retain their original provider...");
    const checkA = await prisma.order.findUnique({ where: { id: orderA.id } });
    const checkB = await prisma.order.findUnique({ where: { id: orderB.id } });
    const checkC = await prisma.order.findUnique({ where: { id: orderC.id } });

    console.log(`- Order A permanently uses: ${checkA?.paymentProvider}`);
    console.log(`- Order B permanently uses: ${checkB?.paymentProvider}`);
    console.log(`- Order C permanently uses: ${checkC?.paymentProvider}`);

    if (checkA?.paymentProvider !== "khqrpay") throw new Error("Order A changed provider!");
    if (checkB?.paymentProvider !== "jla") throw new Error("Order B changed provider!");
    if (checkC?.paymentProvider !== "khqrpay") throw new Error("Order C incorrect provider!");

    console.log("✓ HISTORICAL PROVIDER PERSISTENCE VERIFIED!");

    // ----------------------------------------------------
    // SECURITY AUDIT IN CODE
    // ----------------------------------------------------
    console.log("\n[SECURITY AUDIT] Ensuring ABA_DATA is not leaked...");
    const rawAbaData = process.env.ABA_DATA || "";
    const rawMerchantKey = "ABAPAY7r517608k";

    const jsonInitB = JSON.stringify(initB);
    if (rawAbaData && jsonInitB.includes(rawAbaData)) {
      throw new Error("SECURITY FAILURE: ABA_DATA leaked in initB response!");
    }
    if (jsonInitB.includes(rawMerchantKey)) {
      throw new Error("SECURITY FAILURE: ABA merchant key leaked in initB response!");
    }
    console.log("✓ ABA_DATA and merchant link are strictly protected server-side!");

    console.log("\n====================================================");
    console.log("ALL TESTS PASSED SUCCESSFULLY! ✅");
    console.log("====================================================");
  } finally {
    // Clean up test orders
    await prisma.order.deleteMany({
      where: {
        orderNumber: { in: [orderNumA, orderNumB, orderNumC] },
      },
    });
    console.log("Test orders cleaned up.");
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error("\n❌ TEST FAILED:", err);
  process.exit(1);
});
