import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTelegramInitData, createCustomerToken } from "@/lib/telegramAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.initData) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing required 'initData' parameter in request body.",
        },
        { status: 400 }
      );
    }

    // 🔒 Security: Verify signature and data integrity cryptographically
    // DO NOT trust any client-provided user_id or username
    const validation = verifyTelegramInitData(body.initData);

    if (!validation.valid) {
      return NextResponse.json(
        {
          ok: false,
          error: validation.error,
        },
        { status: 401 }
      );
    }

    const { telegramUserId, username, firstName, lastName, languageCode } =
      validation.user;

    // Store / update only necessary user information in PostgreSQL
    const user = await prisma.user.upsert({
      where: {
        telegramUserId: BigInt(telegramUserId),
      },
      update: {
        username,
        firstName,
        lastName,
        languageCode,
      },
      create: {
        telegramUserId: BigInt(telegramUserId),
        username,
        firstName,
        lastName,
        languageCode,
      },
    });

    // Create session JWT token for the authenticated customer
    const token = createCustomerToken({
      userId: user.id,
      telegramUserId: user.telegramUserId.toString(),
      username: user.username,
    });

    return NextResponse.json({
      ok: true,
      token,
      user: {
        id: user.id,
        telegram_user_id: user.telegramUserId.toString(),
        username: user.username,
        first_name: user.firstName,
        last_name: user.lastName,
        language_code: user.languageCode,
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString(),
      },
    });
  } catch (err: any) {
    console.error("[auth/telegram] Error during authentication:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error during authentication",
      },
      { status: 500 }
    );
  }
}
