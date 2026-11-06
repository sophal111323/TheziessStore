"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, Home } from "lucide-react";

export default function GlobalAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-pink-200 bg-white/95 p-8 text-center shadow-xl backdrop-blur-md">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-100 text-pink-600">
          <AlertCircle className="h-8 w-8" />
        </div>

        <h2 className="font-display text-xl sm:text-2xl font-black text-gray-900">
          មានបញ្ហាបច្ចេកទេសបណ្តោះអាសន្ន
        </h2>

        <p className="mt-2 text-xs sm:text-sm font-semibold text-gray-600 leading-relaxed">
          ប្រព័ន្ធមិនអាចដំណើរការទំព័រនេះបានទេ។ សូមព្យាយាមម្តងទៀត ឬត្រឡប់ទៅទំព័រដើម។
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 px-6 py-3.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-pink-200 hover:shadow-pink-300 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>ព្យាយាមម្តងទៀត (Reload)</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3.5 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>ទំព័រដើម</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

