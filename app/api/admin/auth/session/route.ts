import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/errorLogger";
import { getCurrentAdminFromRequest } from "@/lib/auth";
import { generateCsrfToken } from "@/lib/csrf";

/**
 * GET /api/admin/auth/session
 * 
 * Returns current admin session info including CSRF token.
 * Used by frontend to fetch CSRF token for mutating requests.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdminFromRequest(req);

    if (!admin) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Generate CSRF token for this session
    const csrfToken = generateCsrfToken(admin.id);

    return NextResponse.json({
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
      csrfToken,
    });
  } catch (error) {
    logError("[admin/auth/session] Error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
