"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, Copy, Check, Sparkles, Megaphone } from "lucide-react";
import { MARKETING_ASSETS } from "@/lib/affiliate/store";
import { Affiliate } from "@/lib/affiliate/types";

export default function CreatorMarketingPage() {
  const [creator, setCreator] = useState<Affiliate | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("http://localhost:3000");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }

    fetch("/api/promote/auth")
      .then((r) => r.json())
      .then((data) => {
        if (data?.creator) setCreator(data.creator);
      });
  }, []);

  const referralUrl = creator ? `${origin}/${creator.slug}` : `${origin}/davin`;

  function handleCopyCaption(assetId: string, templateText: string) {
    const customized = templateText.replace(/\{LINK\}/g, referralUrl);
    navigator.clipboard.writeText(customized);
    setCopiedId(assetId);
    setTimeout(() => setCopiedId(null), 2500);
  }

  function handleDownloadImage(url: string, filename: string) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.target = "_blank";
    link.click();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white font-display flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-pink-400" />
          <span>Marketing Materials</span>
        </h1>
        <p className="text-xs text-purple-300/80 mt-0.5">
          High-converting banners and ready-to-post captions with your unique referral link included.
        </p>
      </div>

      {/* Asset Cards Grid */}
      <div className="grid sm:grid-cols-2 gap-6">
        {MARKETING_ASSETS.map((asset) => {
          const personalizedCaption = asset.captionKh.replace(/\{LINK\}/g, referralUrl);
          const isCopied = copiedId === asset.id;

          return (
            <div
              key={asset.id}
              className="rounded-3xl bg-purple-950/60 border border-purple-800/40 overflow-hidden shadow-xl backdrop-blur-md flex flex-col justify-between"
            >
              {/* Asset Preview Header */}
              <div className="relative h-48 sm:h-52 bg-gradient-to-br from-purple-900 via-pink-900 to-indigo-950 flex items-center justify-center p-4">
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="text-center p-4">
                    <span className="inline-block px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 text-[10px] font-extrabold uppercase tracking-widest border border-pink-400/30 mb-2">
                      Official Promo Banner
                    </span>
                    <h4 className="text-lg font-black text-white font-display">{asset.title}</h4>
                    <p className="text-xs text-purple-300/80 mt-1 font-mono">TheziessStore Promo Kit</p>
                  </div>
                </div>
              </div>

              {/* Caption & Actions */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-pink-400 mb-1.5">
                    Pre-Written Social Caption (Khmer Unicode)
                  </span>
                  <div className="rounded-xl bg-purple-900/40 border border-purple-800/50 p-3.5 text-xs text-purple-100 whitespace-pre-line font-khmer leading-relaxed select-all">
                    {personalizedCaption}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleCopyCaption(asset.id, asset.captionKh)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-pink-500 hover:bg-pink-600 py-2.5 px-3 text-xs font-extrabold text-white shadow-lg shadow-pink-500/25 transition-all"
                  >
                    {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span>{isCopied ? "Caption Copied!" : "Copy Caption"}</span>
                  </button>

                  <button
                    onClick={() => handleDownloadImage(asset.imageUrl, `${asset.id}.jpg`)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-purple-700/40 bg-purple-900/50 hover:bg-purple-800/50 py-2.5 px-3 text-xs font-bold text-purple-200 transition-all"
                    title="Download Banner"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

