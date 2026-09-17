import { NextResponse } from "next/server";
import { getAffiliateSettings, getAllAffiliates } from "@/lib/affiliate/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = getAffiliateSettings();
  const currentCount = getAllAffiliates().length;
  const isFull = currentCount >= settings.maxPromoters;

  return NextResponse.json({
    registrationOpen: settings.registrationOpen && !isFull,
    rawRegistrationOpen: settings.registrationOpen,
    maxPromoters: settings.maxPromoters,
    currentPromoters: currentCount,
    isFull,
    closedMessageKh: isFull
      ? `កម្មវិធី Promoter បានពេញកូតាកំណត់ចំនួន ${settings.maxPromoters} នាក់រួចរាល់ហើយ។ សូមរង់ចាំការបើកជុំបន្ទាប់!`
      : (settings.closedMessageKh || "ការចុះឈ្មោះជា Promoter ត្រូវបានបិទបណ្ដោះអាសន្ន។"),
    closedMessageEn: isFull
      ? `Promoter registration has reached capacity (${currentCount}/${settings.maxPromoters}).`
      : (settings.closedMessageEn || "Promoter registration is currently closed."),
  });
}

