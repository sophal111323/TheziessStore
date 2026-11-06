"use client";

import { useRouter } from "next/navigation";
import { clearCsrfToken } from "@/lib/adminFetch";

export default function LogoutButton({
  redirectTo = "/admin/login",
}: {
  redirectTo?: string;
}) {
  const router = useRouter();

  async function handleLogout() {
    // Auth routes are not CSRF-wrapped, so a raw fetch is fine here.
    await fetch("/api/admin/auth", { method: "DELETE", credentials: "include" });
    clearCsrfToken();
    // ✅ ចាកចេញ → redirect ទៅ admin login path (configured via ADMIN_LOGIN_PATH)
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="inline-flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-extrabold text-pink-600 transition-all duration-300 hover:bg-pink-50 hover:text-pink-700 hover:shadow-sm"
    >
      <span>ចាកចេញ</span><span>→</span>
    </button>
  );
}