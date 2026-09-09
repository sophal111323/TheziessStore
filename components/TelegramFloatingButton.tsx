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
      className="fixed z-50 right-5 sm:right-7 bottom-6 sm:bottom-8"
      style={{
        bottom: "max(1.5rem, calc(1.5rem + env(safe-area-inset-bottom, 0px)))",
      }}
    >
      <a
        href="https://t.me/thephal"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contact on Telegram @thephal"
        className="group relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-[#0088cc] to-[#29b6f6] text-white shadow-xl shadow-[#0088cc]/40 hover:shadow-2xl hover:shadow-[#0088cc]/60 hover:scale-110 active:scale-95 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[#29b6f6]/50"
      >
        {/* Subtle breathing pulse ring */}
        <span
          className="absolute inset-0 rounded-full bg-[#29b6f6] opacity-30 animate-ping pointer-events-none group-hover:opacity-50"
          style={{ animationDuration: "2.5s" }}
        />

        {/* Telegram paper plane icon */}
        <svg
          className="w-7 h-7 sm:w-8 sm:h-8 fill-current translate-x-[-1px] translate-y-[1px] transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.75 3.99-1.74 6.66-2.88 7.99-3.44 3.81-1.58 4.6-.86 4.6.86z" />
        </svg>

        {/* Floating tooltip on hover */}
        <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg bg-gray-900/90 px-2.5 py-1 text-xs font-semibold text-white shadow-md backdrop-blur-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100 hidden sm:inline-block">
          Telegram Support
        </span>
      </a>
    </aside>
  );
}
