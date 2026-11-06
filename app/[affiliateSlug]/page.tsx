import Header from "@/components/Header";
import PublicDataRefresh from "@/components/PublicDataRefresh";
import { getPublicHomeData } from "@/lib/publicData";
import Footer from "@/components/Footer";
import GameCard from "@/components/GameCard";
import HeroCarousel from "@/components/HeroCarousel";
import HomeInvisibleTurnstile from "@/components/HomeInvisibleTurnstile";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getAffiliateBySlug } from "@/lib/affiliate/store";
import { Gamepad2 } from "lucide-react";
import AffiliateCookieTracker from "@/components/AffiliateCookieTracker";

export const dynamic = "force-dynamic";

// Reserved top-level routes to ensure they never get intercepted by [affiliateSlug]
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "blog",
  "checkout",
  "faq",
  "games",
  "order",
  "privacy-policy",
  "promote",
  "spin",
  "Terms-of-service",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

export default async function AffiliateStorefrontPage({
  params,
}: {
  params: Promise<{ affiliateSlug: string }>;
}) {
  const { affiliateSlug } = await params;
  const cleanSlug = (affiliateSlug || "").trim().toLowerCase();

  if (RESERVED_SLUGS.has(cleanSlug)) {
    notFound();
  }

  const affiliate = getAffiliateBySlug(cleanSlug);
  if (!affiliate || affiliate.status === "SUSPENDED") {
    notFound();
  }

  const { games, banners } = await getPublicHomeData();

  return (
    <>
      <AffiliateCookieTracker slug={affiliate.slug} />
      <PublicDataRefresh scope="home" intervalMs={15000} />
      <Header />

      {/* ✅ Invisible Turnstile */}
      <HomeInvisibleTurnstile />

      {/* Hero — scrolling image marquee */}
      <section className="relative overflow-hidden pt-0 pb-0 sm:pt-4 sm:pb-3">
        <div className="hero-bg" />

        <div
          className="pointer-events-none absolute top-0 left-1/4 h-72 w-72 rounded-full opacity-30 blur-[100px] animate-float"
          style={{ background: "#9333EA" }}
        />

        <div
          className="pointer-events-none absolute bottom-0 right-1/4 h-60 w-60 rounded-full opacity-20 blur-[100px] animate-float-slow"
          style={{ background: "#C084FC" }}
        />

        {banners.length > 0 ? (
          <HeroCarousel banners={banners} />
        ) : (
          <div className="text-center py-16 text-pink-400 font-semibold">
            <p>Welcome to {affiliate.name}&apos;s Storefront</p>
          </div>
        )}
      </section>

      {/* Game catalog */}
      <section
        id="games"
        className="relative mx-auto max-w-7xl px-2 sm:px-6 pt-2 pb-8 sm:pt-4 sm:pb-12"
      >
        <div className="flex items-center justify-between mb-3 sm:mb-4 px-1 sm:px-0">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-pink-800 flex items-center gap-2">
            <Gamepad2 className="h-6 w-6 sm:h-7 sm:w-7 text-pink-500 shrink-0" strokeWidth={2.4} />
            <span>ហ្គេមទាំងអស់</span>
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
          {games.map((game, i) => (
            <div
              key={game.slug}
              className="fade-up"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              {/* Preserves customer website UI while linking to affiliate path */}
              <GameCard
                slug={`${affiliate.slug}/${game.slug}`}
                name={game.name}
                publisher={game.publisher}
                currencyName={game.currencyName}
                imageUrl={game.imageUrl}
                featured={game.featured}
              />
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </>
  );
}
