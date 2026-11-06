"use client";

import { usePathname } from "next/navigation";

export default function TelegramFloatingButton() {
  const pathname = usePathname();

  // Do not render floating button on admin dashboard pages
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <aside
      aria-label="Telegram Support"
      className="fixed z-50 right-4 sm:right-6 bottom-5 sm:bottom-7 pointer-events-auto select-none"
      style={{
        bottom: "max(1.25rem, calc(1.25rem + env(safe-area-inset-bottom, 0px)))",
      }}
    >
      <a
        href="https://t.me/Theziess"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contact support on Telegram @Theziess"
        className="group relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-[#0077b5] via-[#0088cc] to-[#29b6f6] text-white ring-2 ring-white/40 shadow-[0_8px_25px_rgba(0,136,204,0.55)] hover:shadow-[0_12px_35px_rgba(0,136,204,0.75)] hover:scale-110 active:scale-95 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[#29b6f6]/60"
      >
        {/* Soft background glow pulse */}
        <span
          className="absolute -inset-1 rounded-full bg-[#29b6f6] opacity-35 blur-sm animate-pulse pointer-events-none group-hover:opacity-60 transition-opacity"
        />

        {/* Clean, official Telegram paper airplane icon */}
        <svg
          className="relative w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow-md -translate-x-0.5 translate-y-0.5 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
        </svg>

        {/* Green "Online" status badge */}
        <span className="absolute top-0 right-0 flex h-3.5 w-3.5 sm:h-4 sm:w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 bg-emerald-500 ring-2 ring-white" />
        </span>

        {/* Desktop hover tooltip */}
        <div className="pointer-events-none absolute right-full mr-3 hidden sm:flex items-center opacity-0 -translate-x-2 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0">
          <div className="relative rounded-xl bg-gray-900/90 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-white shadow-xl ring-1 ring-white/10 whitespace-nowrap flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Telegram: @Theziess</span>
          </div>
          {/* Arrow */}
          <div className="w-0 h-0 border-y-4 border-y-transparent border-l-4 border-l-gray-900/90" />
        </div>
      </a>
    </aside>
  );
}
