import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SpinIndexClient from "./SpinIndexClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "កងបង្វិលសំណាង - Lucky Wheel | TheziessStore",
  description: "បង្វិលកងសំណាងដើម្បីឈ្នះពេជ្រ និងរង្វាន់ជាច្រើនពី TheziessStore",
};

export default function SpinPage() {
  return (
    <>
      <Header />
      <SpinIndexClient />
      <Footer />
    </>
  );
}

