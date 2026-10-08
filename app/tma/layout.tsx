import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { TelegramProvider } from "@/components/tma/TelegramProvider";

export const metadata: Metadata = {
  title: "TheziessStore — Telegram Mini App",
  description: "Fast & Secure Game Top-Up inside Telegram",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1a0b2e",
};

export default function TmaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <div className="min-h-screen bg-[#0d0517] text-slate-100 font-sans selection:bg-purple-600 selection:text-white antialiased">
        <TelegramProvider>{children}</TelegramProvider>
      </div>
    </>
  );
}
