import Image from "next/image";
import Header from "@/components/Header";
import PublicDataRefresh from "@/components/PublicDataRefresh";
import { getPublicHomeData } from "@/lib/publicData";
import Footer from "@/components/Footer";
import GameCard from "@/components/GameCard";
import HeroCarousel from "@/components/HeroCarousel";
import HomeInvisibleTurnstile from "@/components/HomeInvisibleTurnstile";
import Link from "next/link";
import {
  Zap,
  ShieldCheck,
  Headphones,
  Tag,
  Gamepad2,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { games, banners } = await getPublicHomeData();

  return (
    <>
      <PublicDataRefresh scope="home" intervalMs={15000} />
      <Header />

      {/* ✅ Invisible Turnstile: auto verify homepage visitor in background */}
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
            <p>
              Add banners in{" "}
              <span className="font-mono text-pink-600">
                Admin → Banners
              </span>{" "}
              to show images here.
            </p>
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
              <GameCard
                slug={game.slug}
                name={game.name}
                publisher={game.publisher}
                currencyName={game.currencyName}
                imageUrl={game.imageUrl}
                featured={game.featured}
              />
            </div>
          ))}
        </div>

        {games.length === 0 && (
          <div className="text-center py-20 text-pink-400 font-semibold">
            <p>
              No games yet. Run{" "}
              <code className="text-pink-600 font-mono">
                npm run db:seed
              </code>{" "}
              to populate.
            </p>
          </div>
        )}
      </section>



      {/* Features */}
      <section className="relative mx-auto max-w-5xl px-3 sm:px-6 pt-2 pb-10 sm:pt-4 sm:pb-12">
        <div className="mb-3 sm:mb-4 px-1 sm:px-0">
          <h2 className="font-display text-lg sm:text-2xl font-extrabold text-pink-800 flex items-center gap-2">
            <span>✨</span>
            <span>ហេតុអ្វីបានជ្រើសរើសយកពួកយើង?</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4.5">
          {[
            {
              Icon: Zap,
              title: "ដឹកជញ្ជូនភ្លាមៗ",
              desc: "ចូល Player ID ផ្ទាល់ភ្លាមៗ ២៤/៧",
            },
            {
              Icon: ShieldCheck,
              title: "ការទូទាត់មានសុវត្ថិភាព",
              desc: "សុវត្ថិភាព ១០០% មិនប៉ះពាល់អាខោន",
            },
            {
              Icon: Headphones,
              title: "សេវាកម្ម ២៤/៧",
              desc: "នៅទីនេះជានិច្ចដើម្បីជួយអ្នក",
            },
            {
              Icon: Tag,
              title: "តម្លៃល្អបំផុត",
              desc: "តម្លៃសមរម្យ និងសន្សំសំចៃបំផុត",
            },
          ].map((f, i) => (
            <div
              key={f.title}
              className="group flex flex-col items-start rounded-2xl sm:rounded-3xl border border-pink-200/80 bg-white/95 p-4 sm:p-6 shadow-sm shadow-pink-100/50 transition-all duration-300 hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-md hover:shadow-pink-200/40 fade-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="mb-3 sm:mb-4 flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 text-white shadow-md shadow-pink-300/40 transition-transform duration-300 group-hover:scale-105">
                <f.Icon className="h-5 w-5 sm:h-5.5 sm:w-5.5" strokeWidth={2.4} />
              </div>

              <h3 className="font-display font-extrabold text-xs sm:text-base text-pink-900 leading-snug mb-1">
                {f.title}
              </h3>

              <p className="text-[11px] sm:text-sm text-pink-600/80 font-medium leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </>
  );
}