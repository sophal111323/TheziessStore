"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

interface TelegramContextValue {
  isReady: boolean;
  isTelegram: boolean;
  user: TelegramUser | null;
  initData: string;
  triggerHaptic: (type?: "light" | "medium" | "heavy" | "success" | "warning" | "error") => void;
  closeApp: () => void;
}

const TelegramContext = createContext<TelegramContextValue>({
  isReady: false,
  isTelegram: false,
  user: null,
  initData: "",
  triggerHaptic: () => {},
  closeApp: () => {},
});

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [initData, setInitData] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const tg = (window as any).Telegram?.WebApp;

    if (tg) {
      try {
        tg.ready();
        tg.expand?.();

        // Style the Telegram chrome
        if (tg.setHeaderColor) tg.setHeaderColor("#1a0b2e");
        if (tg.setBackgroundColor) tg.setBackgroundColor("#0d0517");
        if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();

        setIsTelegram(true);
        const rawInit = tg.initData || "";
        setInitData(rawInit);

        if (tg.initDataUnsafe?.user) {
          setUser(tg.initDataUnsafe.user);
        }

        // Authenticate cryptographically against backend
        if (rawInit) {
          fetch("/auth/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData: rawInit }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.ok && data.token) {
                sessionStorage.setItem("theziess_tma_token", data.token);
              }
            })
            .catch((err) => console.warn("[TelegramProvider] Auth error:", err));
        }
      } catch (err) {
        console.warn("[TelegramProvider] Init warning:", err);
      }
    }

    setIsReady(true);
  }, []);

  const triggerHaptic = (type: "light" | "medium" | "heavy" | "success" | "warning" | "error" = "light") => {
    if (typeof window === "undefined") return;
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.HapticFeedback) return;

    try {
      if (type === "success" || type === "warning" || type === "error") {
        tg.HapticFeedback.notificationOccurred(type);
      } else {
        tg.HapticFeedback.impactOccurred(type);
      }
    } catch {}
  };

  const closeApp = () => {
    if (typeof window === "undefined") return;
    (window as any).Telegram?.WebApp?.close?.();
  };

  return (
    <TelegramContext.Provider
      value={{
        isReady,
        isTelegram,
        user,
        initData,
        triggerHaptic,
        closeApp,
      }}
    >
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}
