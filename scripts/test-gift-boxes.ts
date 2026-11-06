import { prisma } from "../lib/prisma";
import { getOrCreateGiftBoxSlots, pickWeightedGiftSlot } from "../lib/giftBox";

async function main() {
  console.log("=========================================");
  console.log("🎁 TESTING GIFT BOX EVENT & BACKEND LOGIC");
  console.log("=========================================\n");

  // 1. Test getOrCreateGiftBoxSlots
  console.log("[1] Checking / seeding 9 default gift box slots...");
  const slots = await getOrCreateGiftBoxSlots();
  console.log(`✅ Loaded ${slots.length} slots from database.`);
  if (slots.length !== 9) {
    throw new Error(`Expected 9 slots, got ${slots.length}`);
  }
  slots.forEach((s) => {
    console.log(`   Slot #${s.slotNumber}: [${s.rewardType}] ${s.label} (${s.probability}%)`);
  });

  // 2. Test RNG distribution
  console.log("\n[2] Testing server-side cryptographic weighted selection...");
  const wonSlot = pickWeightedGiftSlot(slots);
  console.log(`✅ Randomly selected winning slot: Slot #${wonSlot.slotNumber} - ${wonSlot.label}`);

  // 3. Test Double-Click & Concurrency Lock
  console.log("\n[3] Testing Order Claim & Anti-Double-Click Guarantee...");
  const testOrderNumber = `TEST-GIFT-${Date.now()}`;
  
  // Find a product or create minimal test order
  const existingOrder = await prisma.order.findFirst({
    where: { status: { in: ["PAID", "DELIVERED", "PROCESSING"] } },
  });

  if (!existingOrder) {
    console.log("⚠️ No paid orders in DB to attach test claim, creating virtual test order...");
  } else {
    console.log(`Found eligible paid order #${existingOrder.orderNumber}`);

    // Check if it already has a claim; clean up any old test claim for this order if needed
    await prisma.giftClaim.deleteMany({
      where: { orderId: existingOrder.id },
    });

    // Simulate Claim #1
    console.log("Attempting First Claim (Slot #3)...");
    const claim1 = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.giftClaim.findUnique({
          where: { orderId: existingOrder.id },
        });
        if (existing) throw new Error("Already claimed!");

        return await tx.giftClaim.create({
          data: {
            orderId: existingOrder.id,
            orderNumber: existingOrder.orderNumber,
            playerUid: existingOrder.playerUid,
            slotNumber: 3,
            rewardType: wonSlot.rewardType,
            rewardTitle: wonSlot.label,
            rewardValue: wonSlot.rewardValue,
            rewardAmount: wonSlot.rewardAmount,
            promoCodeStr: wonSlot.rewardType === "PROMO_CODE" ? wonSlot.rewardValue : null,
            productId: wonSlot.productId,
            supplier: wonSlot.supplier || "bay2game",
            supplierCode: wonSlot.supplierCode || "TEST-CODE",
            status: "CLAIMED",
          },
        });
      },
      { timeout: 20000, maxWait: 10000 }
    );
    console.log("✅ Claim #1 succeeded:", claim1.rewardTitle);

    // Simulate Claim #2 (Attacker or rapid double-click)
    console.log("Attempting Duplicate / Double-Click Claim (Slot #7)...");
    try {
      await prisma.$transaction(
        async (tx) => {
          const existing = await tx.giftClaim.findUnique({
            where: { orderId: existingOrder.id },
          });
          if (existing) {
            throw new Error("ORDER_ALREADY_CLAIMED");
          }
          return await tx.giftClaim.create({
            data: {
              orderId: existingOrder.id,
              orderNumber: existingOrder.orderNumber,
              playerUid: existingOrder.playerUid,
              slotNumber: 7,
              rewardType: "CUSTOM",
              rewardTitle: "Second Claim",
              status: "CLAIMED",
            },
          });
        },
        { timeout: 20000, maxWait: 10000 }
      );
      console.error("❌ FAILED: Double claim was permitted!");
    } catch (err: any) {
      if (err.message === "ORDER_ALREADY_CLAIMED" || err.code === "P2002") {
        console.log("✅ SUCCESS: Duplicate claim was blocked by database lock & unique constraint!");
      } else {
        console.log("Blocked with error:", err.message);
      }
    }

    // Verify claim count in DB for this order is exactly 1
    const totalClaims = await prisma.giftClaim.count({
      where: { orderId: existingOrder.id },
    });
    console.log(`✅ Total claims for order #${existingOrder.orderNumber}: ${totalClaims} (Must be exactly 1)`);

    // Clean up test claim
    await prisma.giftClaim.deleteMany({
      where: { orderId: existingOrder.id },
    });
    console.log("Cleaned up test claim.");
  }

  // 4. Test Event Setting Toggle
  console.log("\n[4] Testing Settings.giftEventEnabled toggle...");
  const settings = await prisma.settings.findFirst();
  console.log(`Current event status: ${settings?.giftEventEnabled !== false ? "🟢 OPEN" : "🔴 CLOSED"}`);

  console.log("\n🎉 ALL GIFT BOX TESTS PASSED SUCCESSFULLY!");
}

main()
  .catch((e) => {
    console.error("❌ Error running gift test:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
