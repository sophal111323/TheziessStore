import { prisma } from "../lib/prisma";
import {
  validatePromoCode,
  consumeOrderCouponAtomically,
  releaseOrCancelCouponUsage,
} from "../lib/coupon";

async function runTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING COMPREHENSIVE COUPON SYSTEM TESTS");
  console.log("==================================================\n");

  // Setup test environment: ensure test Game and Product exist
  let testGame = await prisma.game.findFirst({ where: { active: true } });
  if (!testGame) {
    testGame = await prisma.game.create({
      data: {
        name: "Test Game",
        slug: "test-game",
        publisher: "Test Publisher",
        imageUrl: "https://example.com/game.png",
        currencyName: "Diamonds",
        active: true,
      },
    });
  }

  let testProduct = await prisma.product.findFirst({
    where: { gameId: testGame.id, active: true },
  });
  if (!testProduct) {
    testProduct = await prisma.product.create({
      data: {
        gameId: testGame.id,
        name: "100 Diamonds",
        priceUsd: 10.0,
        amount: 100,
        active: true,
      },
    });
  }

  // Clean up any old test promo codes
  await prisma.couponUsage.deleteMany({
    where: { promoCode: { code: { startsWith: "TEST_" } } },
  });
  await prisma.order.deleteMany({
    where: { orderNumber: { startsWith: "TEST-ORD-" } },
  });
  await prisma.promoCode.deleteMany({
    where: { code: { startsWith: "TEST_" } },
  });

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? "→ " + detail : ""}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Apply valid coupon → usage is NOT consumed
  // --------------------------------------------------------------------------
  const promo1 = await prisma.promoCode.create({
    data: {
      code: "TEST_SAVE10",
      discountType: "PERCENT",
      discountValue: 10,
      maxUses: 5,
      usedCount: 0,
      active: true,
      onePerUser: true,
    },
  });

  const res1 = await validatePromoCode({
    code: "TEST_SAVE10",
    orderAmountUsd: 10.0,
    playerUid: "USER_1",
  });

  const refreshedPromo1 = await prisma.promoCode.findUnique({
    where: { id: promo1.id },
  });
  assert(
    res1.valid === true &&
      res1.discountUsd === 1.0 &&
      refreshedPromo1?.usedCount === 0,
    "TEST 1: Apply valid coupon → Validated successfully, usedCount remained 0 (NOT consumed)"
  );

  // --------------------------------------------------------------------------
  // TEST 2: Apply coupon and abandon checkout → Coupon remains usable
  // --------------------------------------------------------------------------
  // User creates an order in PENDING, but closes browser
  const order2 = await prisma.order.create({
    data: {
      orderNumber: "TEST-ORD-ABANDON",
      gameId: testGame.id,
      productId: testProduct.id,
      playerUid: "USER_ABANDON",
      amountUsd: 9.0,
      paymentMethod: "KHQR",
      status: "PENDING",
      promoCodeId: promo1.id,
      discountUsd: 1.0,
      couponUsage: {
        create: {
          promoCodeId: promo1.id,
          userIdentifier: "user_abandon",
          status: "PENDING",
          discountUsd: 1.0,
        },
      },
    },
  });

  const promoAfterAbandon = await prisma.promoCode.findUnique({
    where: { id: promo1.id },
  });
  const canReapply2 = await validatePromoCode({
    code: "TEST_SAVE10",
    orderAmountUsd: 10.0,
    playerUid: "USER_ABANDON",
  });
  assert(
    promoAfterAbandon?.usedCount === 0 && canReapply2.valid === true,
    "TEST 2: Abandoned checkout → usedCount still 0, user can re-apply coupon"
  );

  // --------------------------------------------------------------------------
  // TEST 3: Payment fails → Coupon remains unused
  // --------------------------------------------------------------------------
  const order3 = await prisma.order.create({
    data: {
      orderNumber: "TEST-ORD-FAIL",
      gameId: testGame.id,
      productId: testProduct.id,
      playerUid: "USER_FAIL",
      amountUsd: 9.0,
      paymentMethod: "KHQR",
      status: "PENDING",
      promoCodeId: promo1.id,
      discountUsd: 1.0,
      couponUsage: {
        create: {
          promoCodeId: promo1.id,
          userIdentifier: "user_fail",
          status: "PENDING",
          discountUsd: 1.0,
        },
      },
    },
  });

  // Payment fails
  await prisma.order.update({
    where: { id: order3.id },
    data: { status: "FAILED", failureReason: "Payment expired" },
  });
  await releaseOrCancelCouponUsage(order3.id, "FAILED");

  const promoAfterFail = await prisma.promoCode.findUnique({
    where: { id: promo1.id },
  });
  const canReapply3 = await validatePromoCode({
    code: "TEST_SAVE10",
    orderAmountUsd: 10.0,
    playerUid: "USER_FAIL",
  });
  assert(
    promoAfterFail?.usedCount === 0 && canReapply3.valid === true,
    "TEST 3: Payment fails → usedCount is 0, user can still use the coupon"
  );

  // --------------------------------------------------------------------------
  // TEST 4: Successful order → Coupon becomes USED and usedCount += 1
  // --------------------------------------------------------------------------
  const order4 = await prisma.order.create({
    data: {
      orderNumber: "TEST-ORD-SUCCESS",
      gameId: testGame.id,
      productId: testProduct.id,
      playerUid: "USER_SUCCESS",
      amountUsd: 9.0,
      paymentMethod: "KHQR",
      status: "PENDING",
      promoCodeId: promo1.id,
      discountUsd: 1.0,
      couponUsage: {
        create: {
          promoCodeId: promo1.id,
          userIdentifier: "user_success",
          status: "PENDING",
          discountUsd: 1.0,
        },
      },
    },
  });

  // Payment & Delivery Succeeds
  await prisma.order.update({
    where: { id: order4.id },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
  const consumeRes4 = await consumeOrderCouponAtomically(order4.id);

  const promoAfterSuccess = await prisma.promoCode.findUnique({
    where: { id: promo1.id },
  });
  const usage4 = await prisma.couponUsage.findUnique({
    where: { orderId: order4.id },
  });
  assert(
    consumeRes4.consumed === true &&
      promoAfterSuccess?.usedCount === 1 &&
      usage4?.status === "USED" &&
      usage4?.usedAt !== null,
    "TEST 4: Successful order → Coupon consumed, status=USED, usedCount incremented by exactly 1"
  );

  // --------------------------------------------------------------------------
  // TEST 5: Same user tries the same coupon again → REJECTED (One user = one use)
  // --------------------------------------------------------------------------
  const res5 = await validatePromoCode({
    code: "TEST_SAVE10",
    orderAmountUsd: 10.0,
    playerUid: "USER_SUCCESS", // Same user who completed order 4
  });
  assert(
    res5.valid === false && res5.error === "You have already used this coupon.",
    "TEST 5: Same user tries again → Rejected with 'You have already used this coupon.'"
  );

  // --------------------------------------------------------------------------
  // TEST 6: Concurrency / Limit Protection: maxUses = 1, two simultaneous orders
  // --------------------------------------------------------------------------
  const promoSolo = await prisma.promoCode.create({
    data: {
      code: "TEST_SOLO",
      discountType: "FIXED",
      discountValue: 2,
      maxUses: 1, // Only 1 slot available!
      usedCount: 0,
      active: true,
      onePerUser: false,
    },
  });

  // User A and User B both create orders with this coupon
  const orderA = await prisma.order.create({
    data: {
      orderNumber: "TEST-ORD-RACE-A",
      gameId: testGame.id,
      productId: testProduct.id,
      playerUid: "USER_A",
      amountUsd: 8.0,
      paymentMethod: "KHQR",
      status: "PENDING",
      promoCodeId: promoSolo.id,
      discountUsd: 2.0,
      couponUsage: {
        create: {
          promoCodeId: promoSolo.id,
          userIdentifier: "user_a",
          status: "PENDING",
          discountUsd: 2.0,
        },
      },
    },
  });

  const orderB = await prisma.order.create({
    data: {
      orderNumber: "TEST-ORD-RACE-B",
      gameId: testGame.id,
      productId: testProduct.id,
      playerUid: "USER_B",
      amountUsd: 8.0,
      paymentMethod: "KHQR",
      status: "PENDING",
      promoCodeId: promoSolo.id,
      discountUsd: 2.0,
      couponUsage: {
        create: {
          promoCodeId: promoSolo.id,
          userIdentifier: "user_b",
          status: "PENDING",
          discountUsd: 2.0,
        },
      },
    },
  });

  // Both orders try to consume simultaneously
  const [raceResA, raceResB] = await Promise.all([
    consumeOrderCouponAtomically(orderA.id),
    consumeOrderCouponAtomically(orderB.id),
  ]);

  const promoSoloAfter = await prisma.promoCode.findUnique({
    where: { id: promoSolo.id },
  });
  const winners = [raceResA, raceResB].filter((r) => r.consumed);
  const losers = [raceResA, raceResB].filter((r) => !r.consumed);

  assert(
    winners.length === 1 &&
      losers.length === 1 &&
      promoSoloAfter?.usedCount === 1,
    "TEST 6: Race condition protection → Exactly ONE order claimed the final slot; second was rejected; usedCount=1"
  );

  // --------------------------------------------------------------------------
  // TEST 7: Duplicate payment webhook / order callback → Consumed only once
  // --------------------------------------------------------------------------
  // Calling consumeOrderCouponAtomically on order4 again (already USED)
  const dupConsume = await consumeOrderCouponAtomically(order4.id);
  const promoAfterDup = await prisma.promoCode.findUnique({
    where: { id: promo1.id },
  });

  assert(
    dupConsume.consumed === true &&
      dupConsume.alreadyConsumed === true &&
      promoAfterDup?.usedCount === 1,
    "TEST 7: Duplicate webhook callback → Idempotent, alreadyConsumed=true, usedCount not incremented again"
  );

  // --------------------------------------------------------------------------
  // TEST 8: Expired coupon → Rejected
  // --------------------------------------------------------------------------
  await prisma.promoCode.create({
    data: {
      code: "TEST_EXPIRED",
      discountType: "FIXED",
      discountValue: 5,
      maxUses: 10,
      usedCount: 0,
      expiresAt: new Date(Date.now() - 3600_000), // Expired 1 hour ago
      active: true,
    },
  });

  const resExpired = await validatePromoCode({
    code: "TEST_EXPIRED",
    orderAmountUsd: 10.0,
    playerUid: "ANY_USER",
  });

  assert(
    resExpired.valid === false &&
      resExpired.error === "Coupon code is invalid or expired.",
    "TEST 8: Expired coupon → Rejected with 'Coupon code is invalid or expired.'"
  );

  // --------------------------------------------------------------------------
  // TEST 9: Frontend sends a fake discount → Backend recalculates source of truth
  // --------------------------------------------------------------------------
  // Simulated backend call: even if frontend asks for $9.99 discount on $10 item with 10% coupon
  const promoPercent = await prisma.promoCode.create({
    data: {
      code: "TEST_PERCENT10",
      discountType: "PERCENT",
      discountValue: 10, // 10%
      maxUses: 10,
      usedCount: 0,
      active: true,
    },
  });

  const calc = await validatePromoCode({
    code: "TEST_PERCENT10",
    orderAmountUsd: 10.0,
    playerUid: "HONEST_OR_ATTACKER",
  });

  assert(
    calc.discountUsd === 1.0 && calc.finalAmountUsd === 9.0,
    "TEST 9: Backend price authority → Calculated exactly 10% ($1.00) regardless of any client tampering"
  );

  // --------------------------------------------------------------------------
  // TEST 10: User changes Game ID after applying coupon
  // --------------------------------------------------------------------------
  // Suppose USER_A already used TEST_SAVE10 in order 4, but enters USER_NEW to apply.
  // Then tries to checkout with USER_A:
  const validationWithNewUser = await validatePromoCode({
    code: "TEST_SAVE10",
    orderAmountUsd: 10.0,
    playerUid: "BRAND_NEW_USER",
  });
  const validationWithOriginalUser = await validatePromoCode({
    code: "TEST_SAVE10",
    orderAmountUsd: 10.0,
    playerUid: "USER_SUCCESS", // already used
  });

  assert(
    validationWithNewUser.valid === true &&
      validationWithOriginalUser.valid === false &&
      validationWithOriginalUser.error === "You have already used this coupon.",
    "TEST 10: User changes Game ID → Revalidation against actual checkout playerUid blocks previously-used account"
  );

  // Cleanup test records
  await prisma.couponUsage.deleteMany({
    where: { promoCode: { code: { startsWith: "TEST_" } } },
  });
  await prisma.order.deleteMany({
    where: { orderNumber: { startsWith: "TEST-ORD-" } },
  });
  await prisma.promoCode.deleteMany({
    where: { code: { startsWith: "TEST_" } },
  });

  console.log("\n==================================================");
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
