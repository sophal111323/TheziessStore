import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GiftBoxClient from "./GiftBoxClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ចាប់កាដូសំណាង - Lucky Mystery Gift | TheziessStore",
  description: "បើកប្រអប់កាដូសំណាងឈ្នះកញ្ចប់ហ្គេម គូប៉ុងបញ្ចុះតម្លៃ និងពេជ្រជាច្រើនពី TheziessStore",
};

export default async function GiftBoxOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  return (
    <div className="min-h-screen flex flex-col bg-[#0b0416] text-white">
      <Header />
      <main className="flex-1">
        <GiftBoxClient orderNumber={orderNumber.toUpperCase()} />
      </main>
      <Footer />
    </div>
  );
}
