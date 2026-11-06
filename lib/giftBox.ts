import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export interface GiftSlotData {
  id?: string;
  slotNumber: number;
  label: string;
  rewardType: "GAME_PACKAGE" | "PROMO_CODE" | "DIAMOND" | "CUSTOM" | "THANK_YOU";
  rewardValue?: string | null;
  rewardAmount: number;
  productId?: string | null;
  promoCodeId?: string | null;
  supplier?: string;
  supplierCode?: string | null;
  inStock?: boolean;
  probability: number;
  color: string;
  icon?: string | null;
  active: boolean;
}

const DEFAULT_SLOTS: GiftSlotData[] = [
  {
    slotNumber: 1,
    label: "💎 100 Diamonds",
    rewardType: "DIAMOND",
    rewardAmount: 100,
    probability: 15,
    color: "#9333ea",
    icon: "💎",
    active: true,
  },
  {
    slotNumber: 2,
    label: "🏷️ កូដបញ្ចុះតម្លៃ 10%",
    rewardType: "PROMO_CODE",
    rewardValue: "LUCKY10",
    rewardAmount: 10,
    probability: 20,
    color: "#a855f7",
    icon: "🎟️",
    active: true,
  },
  {
    slotNumber: 3,
    label: "💎 50 Diamonds",
    rewardType: "DIAMOND",
    rewardAmount: 50,
    probability: 25,
    color: "#8b5cf6",
    icon: "💎",
    active: true,
  },
  {
    slotNumber: 4,
    label: "🏷️ កូដបញ្ចុះតម្លៃ 20%",
    rewardType: "PROMO_CODE",
    rewardValue: "LUCKY20",
    rewardAmount: 20,
    probability: 10,
    color: "#c084fc",
    icon: "🎟️",
    active: true,
  },
  {
    slotNumber: 5,
    label: "🎁 កញ្ចប់ពិសេស (Item Box)",
    rewardType: "CUSTOM",
    rewardValue: "Special Item Box",
    rewardAmount: 1,
    probability: 10,
    color: "#d946ef",
    icon: "🎁",
    active: true,
  },
  {
    slotNumber: 6,
    label: "💎 200 Diamonds",
    rewardType: "DIAMOND",
    rewardAmount: 200,
    probability: 5,
    color: "#7e22ce",
    icon: "💎",
    active: true,
  },
  {
    slotNumber: 7,
    label: "🏷️ កូដបញ្ចុះតម្លៃ $0.50",
    rewardType: "PROMO_CODE",
    rewardValue: "LUCKY50C",
    rewardAmount: 50,
    probability: 10,
    color: "#a21caf",
    icon: "🎟️",
    active: true,
  },
  {
    slotNumber: 8,
    label: "💎 30 Diamonds",
    rewardType: "DIAMOND",
    rewardAmount: 30,
    probability: 4,
    color: "#6b21a8",
    icon: "💎",
    active: true,
  },
  {
    slotNumber: 9,
    label: "👑 រង្វាន់ធំ Jackpot 500 💎",
    rewardType: "CUSTOM",
    rewardValue: "Jackpot 500 Diamonds",
    rewardAmount: 500,
    probability: 1,
    color: "#ec4899",
    icon: "👑",
    active: true,
  },
];

/**
 * Ensures all 9 gift box slots exist in the database.
 * If slots are missing, seeds default slots.
 */
export async function getOrCreateGiftBoxSlots() {
  const existing = await prisma.giftBoxSlot.findMany({
    orderBy: { slotNumber: "asc" },
    include: {
      product: { select: { id: true, name: true, priceUsd: true, imageUrl: true } },
      promoCode: { select: { id: true, code: true, discountType: true, discountValue: true } },
    },
  });

  if (existing.length >= 9) {
    return existing;
  }

  // Seed missing slots
  for (const def of DEFAULT_SLOTS) {
    const found = existing.find((s) => s.slotNumber === def.slotNumber);
    if (!found) {
      await prisma.giftBoxSlot.upsert({
        where: { slotNumber: def.slotNumber },
        create: {
          slotNumber: def.slotNumber,
          label: def.label,
          rewardType: def.rewardType,
          rewardValue: def.rewardValue || null,
          rewardAmount: def.rewardAmount,
          probability: def.probability,
          color: def.color,
          icon: def.icon || "🎁",
          active: def.active,
        },
        update: {},
      });
    }
  }

  return prisma.giftBoxSlot.findMany({
    orderBy: { slotNumber: "asc" },
    include: {
      product: { select: { id: true, name: true, priceUsd: true, imageUrl: true } },
      promoCode: { select: { id: true, code: true, discountType: true, discountValue: true } },
    },
  });
}

/**
 * Cryptographic weighted random selector for gift slots.
 */
export function pickWeightedGiftSlot<T extends { probability: number; active: boolean }>(
  slots: T[]
): T {
  const activeSlots = slots.filter((s) => s.active && s.probability > 0);
  if (activeSlots.length === 0) {
    return slots[0];
  }

  const totalWeight = activeSlots.reduce((sum, s) => sum + s.probability, 0);
  // Cryptographically secure integer strictly > 0
  const randomFactor = crypto.randomInt(1, 10_000_001) / 10_000_000;
  const threshold = randomFactor * totalWeight;

  let cumulative = 0;
  for (const slot of activeSlots) {
    cumulative += slot.probability;
    if (threshold <= cumulative) {
      return slot;
    }
  }

  return activeSlots[activeSlots.length - 1];
}
