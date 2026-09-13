"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, ArrowRight, Gift, ShieldCheck, Zap, Trophy } from "lucide-react";

export default function SpinIndexClient() {
  const router = useRouter();
  const [orderInput, setOrderInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = orderInput.trim().toUpperCase();
    if (!trimmed) {
      setError("សូមបញ្ចូលលេខបញ្ជាទិញ (Order Number) របស់អ្នក");
      return;
    }
    setError(null);
    router.push(`/spin/${encodeURIComponent(trimmed)}`);
  };

  return (
    <main className="min-h-[80vh] px-4 py-12 sm:py-16 max-w-4xl mx-auto">
      {/* Hero Header */}
      <div className="text-center space-y-4 mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-100 text-pink-700 text-xs sm:text-sm font-semibold border border-pink-200 shadow-sm animate-pulse">
          <Sparkles className="w-4 h-4 text-pink-500" />
          Mystery Box & Lucky Spin Wheel
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900">
          កងបង្វិលសំណាង <span className="text-pink-600">TheziessStore</span>
        </h1>

        <p className="text-gray-600 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
          បញ្ចូលលេខបញ្ជាទិញរបស់អ្នកដើម្បីបង្វិលកងសំណាង និងឈ្នះរង្វាន់ពេជ្រជាច្រើន
          រង្វាន់នឹងត្រូវបានផ្ញើជូនចូលក្នុង Account ហ្គេមរបស់អ្នកដោយស្វ័យប្រវត្តិ!
        </p>
      </div>

      {/* Order Lookup Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-pink-100 max-w-xl mx-auto mb-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-pink-50 rounded-full blur-2xl -z-10 pointer-events-none" />

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-bold text-gray-800">
            លេខបញ្ជាទិញ (Order Number)
          </label>
          <div className="relative">
            <input
              type="text"
              value={orderInput}
              onChange={(e) => {
                setOrderInput(e.target.value);
                if (error) setError(null);
              }}
              placeholder="ឧទាហរណ៍៖ TZ-2026-XXXXX"
              className="w-full px-4 py-3.5 rounded-2xl border border-gray-300 focus:border-pink-500 focus:ring-4 focus:ring-pink-100 outline-none uppercase font-mono text-base transition-all"
            />
          </div>

          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 text-white font-bold text-base shadow-lg shadow-pink-200 hover:shadow-pink-300 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>ចូលទៅបង្វិលកងឥឡូវនេះ</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          ចំណាំ៖ អ្នកត្រូវតែបានទូទាត់ប្រាក់ជោគជ័យលើកញ្ចប់ Mystery Box ជាមុនសិន
        </p>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="bg-white/80 backdrop-blur rounded-2xl p-6 border border-pink-100 shadow-sm text-center">
          <div className="w-12 h-12 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center mx-auto mb-4">
            <Gift className="w-6 h-6" />
          </div>
          <h2 className="font-bold text-gray-900 mb-1 text-base">១. ទិញ Mystery Box</h2>
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
            ជ្រើសរើសកញ្ចប់ Mystery Box ពីហ្គេមដែលអ្នកចូលចិត្ត និងទូទាត់ប្រាក់តាម KHQR ដោយសុវត្ថិភាព។
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur rounded-2xl p-6 border border-pink-100 shadow-sm text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-6 h-6" />
          </div>
          <h2 className="font-bold text-gray-900 mb-1 text-base">២. បង្វិលកងសំណាង</h2>
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
            ចុចបង្វិលកងដោយប្រើប្រព័ន្ធ RNG សុក្រឹត ១០០% ដើម្បីឈ្នះរង្វាន់ពេជ្រ ឬ Item ពិសេស។
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur rounded-2xl p-6 border border-pink-100 shadow-sm text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-6 h-6" />
          </div>
          <h2 className="font-bold text-gray-900 mb-1 text-base">៣. ទទួលរង្វាន់ស្វ័យប្រវត្តិ</h2>
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
            ចុច Claim រង្វាន់ដើម្បីបញ្ចូល Credits ទៅកាន់ Game UID របស់អ្នកភ្លាមៗ ដោយមិនបាច់រង់ចាំ។
          </p>
        </div>
      </div>

      {/* Footer Banner */}
      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-pink-600 hover:text-pink-700 transition-colors"
        >
          <span>ត្រឡប់ទៅទំព័រដើម និងមើលហ្គេមទាំងអស់</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </main>
  );
}

