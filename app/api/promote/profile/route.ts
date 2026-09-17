import { NextRequest, NextResponse } from "next/server";
import { getCurrentCreator } from "@/lib/affiliate/session";
import { updateAffiliateProfile } from "@/lib/affiliate/store";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const creator = await getCurrentCreator();
  if (!creator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const updated = updateAffiliateProfile(creator.id, {
      name: body.name,
      phone: body.phone,
      telegram: body.telegram,
      facebook: body.facebook,
      tiktok: body.tiktok,
      youtube: body.youtube,
    });

    if (!updated) {
      return NextResponse.json({ error: "Failed to update profile" }, { status: 400 });
    }

    return NextResponse.json({ success: true, creator: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update profile" }, { status: 500 });
  }
}

