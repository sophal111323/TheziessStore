import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SpinWheelClient from "./SpinWheelClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "កងបង្វិលសំណាង - Lucky Wheel | TheziessStore",
  description: "បង្វិលកងសំណាងដើម្បីឈ្នះពេជ្រ និងរង្វាន់ជាច្រើនពី TheziessStore",
};

export default async function SpinOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  return (
    <>
      <Header />
      <SpinWheelClient orderNumber={orderNumber.toUpperCase()} />
      <Footer />
    </>
  );
}

