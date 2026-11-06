import type { Metadata } from "next";
import "./globals.css";
import { headers } from "next/headers";
import { CurrencyProvider } from "@/lib/currency";
import RouteProgress from "@/components/RouteProgress";
import AnnouncementBar from "@/components/AnnouncementBar";
import MaintenanceGate from "@/components/MaintenanceGate";
import PublicDataRefresh from "@/components/PublicDataRefresh";
import TelegramFloatingButton from "@/components/TelegramFloatingButton";
import { getPublicSettings } from "@/lib/publicData";

export const metadata: Metadata = {
  metadataBase: new URL("https://theziessstore.store"),
  title: {
    default: "TheziessStore - សេវាកម្មបញ្ចូលលុយហ្គេម Free Fire, Mobile Legends, PUBG, Roblox នៅកម្ពុជា",
    template: "%s | TheziessStore",
  },
  description:
    "TheziessStore - ហាងបញ្ចូលលុយហ្គេមអនឡាញឈានមុខគេនៅកម្ពុជា។ បញ្ចូលពេជ្រ Free Fire, Mobile Legends Diamonds, PUBG Mobile UC, Roblox Robux, Minecraft យ៉ាងរហ័ស ២៤/៧ ទូទាត់តាម KHQR, ABA, Wing សុវត្ថិភាពខ្ពស់។",
  keywords: [
    // Khmer Primary Keywords
    "បញ្ចូលលុយហ្គេម",
    "ទិញពេជ្រ Free Fire",
    "បញ្ចូលពេជ្រ Free Fire កម្ពុជា",
    "ទិញពេជ្រ FF តម្លៃថោក",
    "បញ្ចូលពេជ្រ Mobile Legends",
    "ទិញពេជ្រ MLBB",
    "ទិញ UC PUBG Mobile",
    "បញ្ចូលលុយ PUBG កម្ពុជា",
    "បញ្ចូលលុយ Roblox",
    "ទិញ Robux តម្លៃសមរម្យ",
    "ទិញ Minecraft កម្ពុជា",
    "Minecraft Java Bedrock",
    "បញ្ចូលលុយហ្គេមតាម KHQR",
    "បញ្ចូលពេជ្រតាម ABA",
    "ហាងលក់ពេជ្រ TheziessStore",
    "Top up game Cambodia",
    "សេវាបញ្ចូលពេជ្ររហ័ស 24 ម៉ោង",
    // English Secondary Keywords
    "TheziessStore",
    "Free Fire diamond top up",
    "Free Fire top up Cambodia",
    "Mobile Legends diamonds top up",
    "PUBG Mobile UC shop Cambodia",
    "Roblox Robux top up",
    "Minecraft top up Cambodia",
    "KHQR payment game topup",
    "instant game top up Cambodia",
    "cheap game diamonds Cambodia",
  ],
  alternates: {
    canonical: "https://theziessstore.store",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "km_KH",
    alternateLocale: ["en_US"],
    url: "https://theziessstore.store",
    siteName: "TheziessStore",
    title: "TheziessStore - សេវាកម្មបញ្ចូលលុយហ្គេម Free Fire, Mobile Legends, PUBG, Roblox នៅកម្ពុជា",
    description:
      "បញ្ចូលពេជ្រ Free Fire, Mobile Legends Diamonds, PUBG UC, Roblox Robux, Minecraft យ៉ាងរហ័ស ទូទាត់តាម KHQR សុវត្ថិភាព ២៤/៧។",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "TheziessStore Game Top-Up Cambodia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TheziessStore - សេវាកម្មបញ្ចូលលុយហ្គេមនៅកម្ពុជា",
    description:
      "Instant Top Up for Free Fire, Mobile Legends, PUBG, Roblox, Minecraft with KHQR payment.",
    images: ["/icon-512.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "geo.region": "KH",
    "geo.placename": "Phnom Penh",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? undefined;

  const settings = await getPublicSettings();
  const exchangeRate = settings.exchangeRate;

  // JSON-LD Structured Data for Google Search Indexing
  const jsonLdSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://theziessstore.store/#organization",
        name: "TheziessStore",
        alternateName: "Theziess Store Cambodia",
        url: "https://theziessstore.store",
        logo: "https://theziessstore.store/icon-512.png",
        description:
          "សេវាកម្មបញ្ចូលលុយហ្គេមអនឡាញឈានមុខគេនៅកម្ពុជា សម្រាប់ Free Fire, Mobile Legends, PUBG Mobile, Roblox, និង Minecraft។",
        sameAs: [
          "https://t.me/theziessstore",
        ],
      },
      {
        "@type": "WebSite",
        "@id": "https://theziessstore.store/#website",
        url: "https://theziessstore.store",
        name: "TheziessStore",
        description: "Instant Game Top-Up Store in Cambodia with KHQR Payment",
        publisher: {
          "@id": "https://theziessstore.store/#organization",
        },
        inLanguage: ["km-KH", "en-US"],
        potentialAction: {
          "@type": "SearchAction",
          target: "https://theziessstore.store/?search={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "OnlineStore",
        "@id": "https://theziessstore.store/#store",
        name: "TheziessStore",
        url: "https://theziessstore.store",
        description: "ហាងបញ្ចូលពេជ្រ និងទិញ Item ហ្គេមស្របច្បាប់រហ័សទាន់ចិត្ត ២៤/៧",
        priceRange: "$0.01 - $500",
        paymentAccepted: "KHQR, ABA Mobile, ACLEDA Mobile, Wing Bank",
        currenciesAccepted: "USD, KHR",
        parentOrganization: {
          "@id": "https://theziessstore.store/#organization",
        },
      },
    ],
  };

  return (
    <html lang="km">
      <head>
        {nonce && (
          <style nonce={nonce} suppressHydrationWarning />
        )}
        {/* JSON-LD Schema Markup */}
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSchema) }}
        />
      </head>
      <body>
        <RouteProgress />
        <PublicDataRefresh scope="settings" intervalMs={20000} />

        <CurrencyProvider exchangeRate={exchangeRate}>
          <AnnouncementBar />
          <MaintenanceGate />
          {children}
          <TelegramFloatingButton />
        </CurrencyProvider>
      </body>
    </html>
  );
}
