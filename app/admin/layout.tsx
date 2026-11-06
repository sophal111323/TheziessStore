import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getCurrentAdmin } from "@/lib/auth";
import { getAdminLoginPath } from "@/lib/adminLoginPath";
import AdminSidebar from "@/components/AdminSidebar";
import AdminPageTransition from "@/components/AdminPageTransition";
import AdminClickSound from "@/components/AdminClickSound";
import AdminMouseEffect from "@/components/AdminMouseEffect";

const ADMIN_COOKIE_NAME = "admin_token";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const adminLoginPath = getAdminLoginPath();
  const admin = await getCurrentAdmin();

  if (!admin) {
    const cookieStore = await cookies();
    const hasToken = Boolean(cookieStore.get(ADMIN_COOKIE_NAME)?.value);

    if (hasToken) {
      redirect(adminLoginPath);
    }

    return <>{children}</>;
  }

  return (
    <div className="admin-root flex min-h-screen bg-fox-bg text-fox-text">
      <AdminClickSound />
      <AdminMouseEffect />
      <AdminSidebar adminEmail={admin.email} loginPath={adminLoginPath} />
      <AdminPageTransition>{children}</AdminPageTransition>
    </div>
  );
}
