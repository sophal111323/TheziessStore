export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";

export const PATCH = withAdminAuth(
  async (req: NextRequest) => {
    const body = await req.json().catch(() => ({}));
    const { enabled } = body;

    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      create: { giftEventEnabled: Boolean(enabled) },
      update: { giftEventEnabled: Boolean(enabled) },
    });

    return NextResponse.json({
      ok: true,
      giftEventEnabled: settings.giftEventEnabled,
      message: settings.giftEventEnabled
        ? "កម្មវិធីចាប់កាដូត្រូវបានបើកដំណើរការ (Gift event opened)"
        : "កម្មវិធីចាប់កាដូត្រូវបានបិទ (Gift event closed)",
    });
  },
  { permission: "settings.write" }
);
