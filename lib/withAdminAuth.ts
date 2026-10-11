import { NextRequest, NextResponse } from "next/server";
import { getAdminAuthFromRequest } from "@/lib/auth";
import type { Admin } from "@prisma/client";
import {
  forbiddenResponse,
  hasAnyAdminPermission,
  isAdminRoleAllowed,
  type AdminPermission,
  type NormalizedAdminRole,
} from "@/lib/adminPermissions";
import { verifyCsrfToken } from "@/lib/csrf";

type RouteParams = Record<string, string>;

export type AdminRouteContext<TParams extends RouteParams = RouteParams> = {
  params: Promise<TParams>;
};

type AuthedHandler<TParams extends RouteParams = RouteParams> = (
  req: NextRequest,
  ctx: AdminRouteContext<TParams>,
  admin: Admin
) => Promise<Response> | Response;

type AdminAuthOptions = {
  permission?: AdminPermission;
  permissions?: AdminPermission[];
  roles?: NormalizedAdminRole[];
};

export function withAdminAuth<TParams extends RouteParams = RouteParams>(
  handler: AuthedHandler<TParams>,
  options: AdminAuthOptions = {}
) {
  return async function (
    req: NextRequest,
    ctx: AdminRouteContext<TParams>
  ): Promise<Response> {
    const auth = await getAdminAuthFromRequest(req);

    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const { admin } = auth;

    // CSRF protection for state-changing requests (FIND-010 fix).
    // Only cookie-authenticated (browser) requests are CSRF-exposed; Bearer
    // clients (Flutter mobile admin) send credentials explicitly.
    const method = req.method.toUpperCase();
    const isStateMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    
    if (isStateMutating && auth.method === "cookie") {
      const csrfToken = req.headers.get("x-csrf-token");
      const isValidCsrf = verifyCsrfToken(admin.id, csrfToken);
      
      if (!isValidCsrf) {
        return NextResponse.json(
          { error: "CSRF token missing or invalid" },
          {
            status: 403,
            headers: {
              "Cache-Control": "no-store",
            },
          }
        );
      }
    }

    if (options.roles && !isAdminRoleAllowed(admin, options.roles)) {
      return forbiddenResponse("Your admin role cannot access this resource.");
    }

    const permissions = [
      ...(options.permission ? [options.permission] : []),
      ...(options.permissions || []),
    ];

    if (permissions.length > 0 && !hasAnyAdminPermission(admin, permissions)) {
      return forbiddenResponse("Your admin role cannot perform this action.");
    }

    return handler(req, ctx, admin);
  };
}
