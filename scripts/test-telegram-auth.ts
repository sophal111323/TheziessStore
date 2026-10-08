/**
 * Test Suite for Telegram WebApp Authentication (POST /auth/telegram)
 *
 * Verifies:
 * 1. Rejecting requests without initData.
 * 2. Rejecting tampered / forged initData signatures.
 * 3. Rejecting expired initData.
 * 4. Accepting cryptographically valid initData signed by TELEGRAM_BOT_TOKEN.
 * 5. Verifying DB persistence in PostgreSQL (users table).
 * 6. Verifying JWT session token issuance and verification.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

import { prisma } from "../lib/prisma";
import { verifyTelegramInitData, verifyCustomerToken } from "../lib/telegramAuth";
import { POST as authHandler } from "../app/auth/telegram/route";
import { NextRequest } from "next/server";

function createValidInitData(botToken: string, userObj: Record<string, any>, authDate = Math.floor(Date.now() / 1000)) {
  const userJson = JSON.stringify(userObj);
  const params: Record<string, string> = {
    auth_date: String(authDate),
    query_id: "AAHdF6IQAAAAAN0XohD18bXz",
    user: userJson,
  };

  const pairs = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);

  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const queryParams = new URLSearchParams(params);
  queryParams.set("hash", hash);

  return queryParams.toString();
}

async function runTestSuite() {
  console.log("==========================================================");
  console.log("🧪 TESTING TELEGRAM USER AUTHENTICATION (STEP 4)");
  console.log("==========================================================\n");

  const botToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!botToken) {
    console.error("❌ TELEGRAM_BOT_TOKEN is missing from .env");
    process.exit(1);
  }
  console.log("🔑 Bot token detected from .env");

  // TEST 1: Reject request with empty body
  console.log("\n[TEST 1] Missing initData rejection...");
  const req1 = new NextRequest("http://localhost:3000/auth/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const res1 = await authHandler(req1);
  const data1 = await res1.json();
  if (res1.status === 400 && data1.ok === false) {
    console.log("✅ Passed: Correctly returned 400 when initData is missing.");
  } else {
    console.error("❌ Failed:", res1.status, data1);
  }

  // TEST 2: Reject forged / fake hash
  console.log("\n[TEST 2] Forged signature rejection...");
  const fakeInitData = "auth_date=1710000000&user=%7B%22id%22%3A99999999%7D&hash=deadbeef00000000000000000000000000000000000000000000000000000000";
  const req2 = new NextRequest("http://localhost:3000/auth/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData: fakeInitData }),
  });
  const res2 = await authHandler(req2);
  const data2 = await res2.json();
  if (res2.status === 401 && data2.ok === false) {
    console.log("✅ Passed: Correctly rejected forged hash with 401 Unauthorized.");
  } else {
    console.error("❌ Failed:", res2.status, data2);
  }

  // TEST 3: Reject expired initData (> 24 hours old)
  console.log("\n[TEST 3] Expired auth_date rejection...");
  const oldTimestamp = Math.floor(Date.now() / 1000) - 90000; // 25 hours ago
  const expiredInitData = createValidInitData(botToken, { id: 1234567, first_name: "Old" }, oldTimestamp);
  const req3 = new NextRequest("http://localhost:3000/auth/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData: expiredInitData }),
  });
  const res3 = await authHandler(req3);
  const data3 = await res3.json();
  if (res3.status === 401 && data3.error.includes("expired")) {
    console.log("✅ Passed: Correctly rejected expired initData.");
  } else {
    console.error("❌ Failed:", res3.status, data3);
  }

  // TEST 4: Valid Telegram initData authentication & DB persistence
  console.log("\n[TEST 4] Cryptographically valid initData authentication...");
  const testTelegramUserId = 7301310227; // Sample store Telegram ID
  const testUserData = {
    id: testTelegramUserId,
    first_name: "Theziess",
    last_name: "Customer",
    username: "theziess_tester",
    language_code: "en",
  };

  const validInitData = createValidInitData(botToken, testUserData);
  const req4 = new NextRequest("http://localhost:3000/auth/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData: validInitData }),
  });
  const res4 = await authHandler(req4);
  const data4 = await res4.json();

  if (res4.status === 200 && data4.ok === true && data4.token && data4.user) {
    console.log("✅ Passed: Authenticated successfully (HTTP 200).");
    console.log("   User ID:", data4.user.id);
    console.log("   Telegram User ID:", data4.user.telegram_user_id);
    console.log("   Username:", data4.user.username);
    console.log("   First Name:", data4.user.first_name);
    console.log("   Last Name:", data4.user.last_name);
    console.log("   Language Code:", data4.user.language_code);
    console.log("   Created At:", data4.user.created_at);
    console.log("   Updated At:", data4.user.updated_at);

    // Verify token validity
    const verifiedToken = verifyCustomerToken(data4.token);
    if (verifiedToken && verifiedToken.telegramUserId === String(testTelegramUserId)) {
      console.log("✅ Passed: Customer JWT token verified successfully.");
    } else {
      console.error("❌ Token verification failed:", verifiedToken);
    }

    // Verify direct DB query in PostgreSQL
    console.log("\n[TEST 5] Verifying PostgreSQL persistence...");
    const dbUser = await prisma.user.findUnique({
      where: { telegramUserId: BigInt(testTelegramUserId) },
    });

    if (dbUser && dbUser.username === testUserData.username) {
      console.log("✅ Passed: User found in PostgreSQL 'users' table!");
      console.log("   DB Record:", {
        id: dbUser.id,
        telegramUserId: dbUser.telegramUserId.toString(),
        username: dbUser.username,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        languageCode: dbUser.languageCode,
      });
    } else {
      console.error("❌ User not found in database:", dbUser);
    }
  } else {
    console.error("❌ Failed to authenticate valid initData:", res4.status, data4);
  }

  console.log("\n==========================================================");
  console.log("🎉 ALL STEP 4 AUTHENTICATION TESTS COMPLETED");
  console.log("==========================================================\n");

  await prisma.$disconnect();
}

runTestSuite().catch((err) => {
  console.error("❌ Test suite encountered unhandled error:", err);
  process.exit(1);
});
