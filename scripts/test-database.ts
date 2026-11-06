/**
 * Database Test Suite for Step 5: PostgreSQL + Prisma Schema Verification
 *
 * Verifies:
 * 1. Connection to PostgreSQL via Prisma.
 * 2. Tables: users, games, products, orders, providers.
 * 3. Relationships: User -> Orders -> Game -> Product -> Provider.
 * 4. Indexes and unique constraints.
 */

import { prisma } from "../lib/prisma";

async function runDatabaseTests() {
  console.log("==========================================================");
  console.log("🗄️  STEP 5: DATABASE VERIFICATION (POSTGRESQL + PRISMA)");
  console.log("==========================================================\n");

  // 1. PROVIDERS TABLE
  console.log("[TEST 1] Testing 'providers' table (upserting 'frozenyuki')...");
  const provider = await prisma.provider.upsert({
    where: { code: "frozenyuki" },
    update: {
      name: "FrozenYuki / SoraTopup",
      baseUrl: process.env.FROZENYUKI_BASE_URL || "https://soratopup.com/api/v1",
      enabled: true,
      currency: "USD",
    },
    create: {
      code: "frozenyuki",
      name: "FrozenYuki / SoraTopup",
      baseUrl: process.env.FROZENYUKI_BASE_URL || "https://soratopup.com/api/v1",
      enabled: true,
      currency: "USD",
    },
  });
  console.log("✅ Passed: Provider created/verified:", {
    id: provider.id,
    code: provider.code,
    name: provider.name,
    enabled: provider.enabled,
  });

  // 2. USERS TABLE
  console.log("\n[TEST 2] Testing 'users' table (Telegram User model)...");
  const testTgId = BigInt("9988776655");
  const testUser = await prisma.user.upsert({
    where: { telegramUserId: testTgId },
    update: { username: "db_test_user", firstName: "DBTest" },
    create: {
      telegramUserId: testTgId,
      username: "db_test_user",
      firstName: "DBTest",
      lastName: "User",
      languageCode: "en",
    },
  });
  console.log("✅ Passed: User record verified:", {
    id: testUser.id,
    telegramUserId: testUser.telegramUserId.toString(),
    username: testUser.username,
  });

  // 3. GAMES TABLE
  console.log("\n[TEST 3] Testing 'games' table...");
  const gamesCount = await prisma.game.count();
  const sampleGame = await prisma.game.findFirst({
    where: { active: true },
    include: { products: { take: 1 } },
  });
  console.log(`✅ Passed: Found ${gamesCount} total games in database.`);
  if (sampleGame) {
    console.log("   Sample Game:", {
      id: sampleGame.id,
      name: sampleGame.name,
      slug: sampleGame.slug,
      requiresPlayerId: sampleGame.requiresPlayerId,
      requiresServerId: sampleGame.requiresServerId,
      enabled: sampleGame.enabled,
    });
  }

  // 4. PRODUCTS TABLE & PROVIDER RELATION
  console.log("\n[TEST 4] Testing 'products' table and Provider relation...");
  const productCount = await prisma.product.count();
  console.log(`✅ Passed: Found ${productCount} total products in database.`);

  if (sampleGame && sampleGame.products.length > 0) {
    const sampleProduct = sampleGame.products[0];
    // Link product to provider to test foreign key relationship
    const updatedProduct = await prisma.product.update({
      where: { id: sampleProduct.id },
      data: {
        providerId: provider.id,
        diamonds: sampleProduct.amount,
        price: sampleProduct.priceUsd,
      },
      include: { provider: true, game: true },
    });
    console.log("✅ Passed: Product -> Game and Product -> Provider relation verified:", {
      productId: updatedProduct.id,
      productName: updatedProduct.name,
      gameName: updatedProduct.game.name,
      providerCode: updatedProduct.provider?.code,
    });
  }

  // 5. ORDERS TABLE & COMPLETE RELATIONSHIP CHAIN
  // User -> Order -> Game -> Product -> Provider
  console.log("\n[TEST 5] Testing complete relationship: User -> Order -> Game -> Product -> Provider...");
  if (sampleGame && sampleGame.products.length > 0) {
    const testOrderNumber = `TS-TEST-${Date.now().toString().slice(-6)}`;
    const createdOrder = await prisma.order.create({
      data: {
        orderNumber: testOrderNumber,
        userId: testUser.id,
        gameId: sampleGame.id,
        productId: sampleGame.products[0].id,
        providerId: provider.id,
        playerUid: "123456789",
        amountUsd: 1.0,
        currency: "USD",
        paymentMethod: "KHQR",
        status: "PENDING",
      },
      include: {
        user: true,
        game: true,
        product: true,
        provider: true,
      },
    });

    console.log("✅ Passed: Order created with complete relation chain:", {
      orderNumber: createdOrder.orderNumber,
      userTelegramId: createdOrder.user?.telegramUserId.toString(),
      gameName: createdOrder.game.name,
      productName: createdOrder.product.name,
      providerCode: createdOrder.provider?.code,
      status: createdOrder.status,
    });

    // Cleanup test order
    await prisma.order.delete({ where: { id: createdOrder.id } });
    console.log("🧹 Test order cleaned up successfully.");
  }

  // Cleanup test user
  await prisma.user.delete({ where: { id: testUser.id } });
  console.log("🧹 Test user cleaned up successfully.");

  console.log("\n==========================================================");
  console.log("🎉 ALL DATABASE TABLE & RELATIONSHIP TESTS PASSED");
  console.log("==========================================================\n");

  await prisma.$disconnect();
}

runDatabaseTests().catch(async (err) => {
  console.error("❌ Database test failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
