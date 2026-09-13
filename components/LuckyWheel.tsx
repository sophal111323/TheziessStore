"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

export interface WheelSlot {
  id: string;
  label: string;
  rewardType: string;
  rewardAmount: number;
  probability: number;
  color: string;
  textColor: string;
  icon?: string | null;
}

interface LuckyWheelProps {
  slots: WheelSlot[];
  onSpinStart?: () => void;
  onSpinEnd?: (slot: WheelSlot) => void;
  isSpinning?: boolean;
  disabled?: boolean;
  targetIndex?: number | null; // index the wheel should stop at (from server)
  size?: number;
}

export default function LuckyWheel({
  slots,
  onSpinStart,
  onSpinEnd,
  isSpinning = false,
  disabled = false,
  targetIndex = null,
  size = 380,
}: LuckyWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentRotationRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastTickSliceRef = useRef<number>(-1);
  const [internalSpinning, setInternalSpinning] = useState(false);

  // Play synthesized tick sound on each passing segment
  const playTickSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state === "suspended") {
        ctx?.resume();
      }
      if (ctx) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch {
      // Audio might be blocked by browser policy until gesture
    }
  }, []);

  // Draw the wheel onto the canvas
  const drawWheel = useCallback(
    (rotationAngle: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const numSlots = slots.length;
      if (numSlots === 0) return;

      const sliceAngle = (2 * Math.PI) / numSlots;
      const radius = canvas.width / 2;
      const center = radius;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate((rotationAngle * Math.PI) / 180);

      // Draw outer rim
      ctx.beginPath();
      ctx.arc(0, 0, radius - 4, 0, 2 * Math.PI);
      ctx.fillStyle = "#1E1B4B";
      ctx.fill();

      // Draw individual slices
      for (let i = 0; i < numSlots; i++) {
        const slot = slots[i];
        const startAngle = i * sliceAngle;
        const endAngle = (i + 1) * sliceAngle;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius - 16, startAngle, endAngle);
        ctx.closePath();

        // Slice background
        ctx.fillStyle = slot.color || (i % 2 === 0 ? "#9333EA" : "#C084FC");
        ctx.fill();

        // Slice border divider
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label and icon
        ctx.save();
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        const textX = radius - 36;
        ctx.fillStyle = slot.textColor || "#FFFFFF";
        ctx.font = `bold ${numSlots > 10 ? 12 : 14}px system-ui, -apple-system, sans-serif`;
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 4;

        // Truncate or simplify label
        const displayLabel = slot.label.replace(/^💎\s*/, "");
        ctx.fillText(displayLabel, textX, 0);

        // Icon near rim
        if (slot.icon) {
          ctx.font = `${numSlots > 10 ? 14 : 18}px system-ui`;
          ctx.fillText(slot.icon, radius - 18, 0);
        }

        ctx.restore();
      }

      // Golden outer light dots
      const numDots = numSlots * 2;
      for (let j = 0; j < numDots; j++) {
        const dotAngle = (j * 2 * Math.PI) / numDots;
        const dotX = (radius - 10) * Math.cos(dotAngle);
        const dotY = (radius - 10) * Math.sin(dotAngle);

        ctx.beginPath();
        ctx.arc(dotX, dotY, 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = j % 2 === 0 ? "#FDE047" : "#FFFFFF";
        ctx.shadowColor = "#FACC15";
        ctx.shadowBlur = 6;
        ctx.fill();
      }

      ctx.restore();

      // Draw Center Hub
      ctx.save();
      ctx.translate(center, center);

      // Hub outer shadow ring
      ctx.beginPath();
      ctx.arc(0, 0, 46, 0, 2 * Math.PI);
      ctx.fillStyle = "#312E81";
      ctx.fill();

      // Hub gold border
      ctx.beginPath();
      ctx.arc(0, 0, 42, 0, 2 * Math.PI);
      ctx.fillStyle = "linear-gradient" in ctx ? "#FACC15" : "#EAB308";
      ctx.fill();

      // Hub center cap
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, 2 * Math.PI);
      ctx.fillStyle = "#4C1D95";
      ctx.fill();

      ctx.restore();
    },
    [slots]
  );

  // Initial render of the wheel
  useEffect(() => {
    drawWheel(currentRotationRef.current);
  }, [drawWheel]);

  // Handle spin animation when targetIndex is received
  useEffect(() => {
    if (targetIndex === null || targetIndex === undefined || internalSpinning) return;

    const numSlots = slots.length;
    if (numSlots === 0 || targetIndex < 0 || targetIndex >= numSlots) return;

    setInternalSpinning(true);
    const sliceDeg = 360 / numSlots;

    // Pointer is at the top (270 degrees in standard canvas coords or 0 relative to pointer).
    // To align the target slice directly under the top pointer:
    // Slot i center angle is: (i + 0.5) * sliceDeg.
    // Target rotation = 270 - (targetIndex + 0.5) * sliceDeg.
    const targetSliceCenter = (targetIndex + 0.5) * sliceDeg;
    // Base target: pointer at 270°
    let targetOffset = 270 - targetSliceCenter;
    while (targetOffset < 0) targetOffset += 360;

    const extraSpins = 5; // 5 full 360 turns
    const startRotation = currentRotationRef.current % 360;
    const finalRotation = currentRotationRef.current + (extraSpins * 360) + (targetOffset - (currentRotationRef.current % 360) + 360) % 360;

    const duration = 4500; // 4.5 seconds
    const startTime = performance.now();

    // Cubic bezier ease-out
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);

      const currentAngle = startRotation + (finalRotation - startRotation) * eased;
      currentRotationRef.current = currentAngle;
      drawWheel(currentAngle);

      // Sound tick calculation
      const currentSlice = Math.floor(((270 - (currentAngle % 360) + 360) % 360) / sliceDeg);
      if (currentSlice !== lastTickSliceRef.current && progress < 0.95) {
        lastTickSliceRef.current = currentSlice;
        playTickSound();
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        currentRotationRef.current = finalRotation;
        drawWheel(finalRotation);
        setInternalSpinning(false);
        if (onSpinEnd) {
          onSpinEnd(slots[targetIndex]);
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [targetIndex, slots, drawWheel, onSpinEnd, playTickSound]);

  const spinning = isSpinning || internalSpinning;

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* Outer Glow Halo */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-pink-500/30 via-purple-500/20 to-yellow-400/20 blur-2xl pointer-events-none scale-110" />

      {/* The Top Pointer / Indicator */}
      <div className="relative z-30 -mb-5 flex flex-col items-center pointer-events-none">
        <div className="w-8 h-10 -rotate-180 drop-shadow-[0_4px_12px_rgba(234,179,8,0.8)] filter">
          <svg viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 0L24 24C24 27.3137 18.6274 30 12 30C5.37258 30 0 27.3137 0 24L12 0Z"
              fill="url(#pointerGold)"
            />
            <path
              d="M12 4L20 22C20 24 16 26 12 26C8 26 4 24 4 22L12 4Z"
              fill="#EF4444"
            />
            <defs>
              <linearGradient id="pointerGold" x1="12" y1="0" x2="12" y2="30" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FEF08A" />
                <stop offset="0.5" stopColor="#EAB308" />
                <stop offset="1" stopColor="#CA8A04" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Wheel Container */}
      <div
        className="relative rounded-full p-2 bg-gradient-to-b from-yellow-300 via-amber-500 to-yellow-600 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-4 ring-yellow-400/50"
        style={{ width: size, height: size }}
      >
        <canvas
          ref={canvasRef}
          width={size * 2}
          height={size * 2}
          className="w-full h-full rounded-full"
        />

        {/* Center Spin Button */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <button
            type="button"
            disabled={disabled || spinning}
            onClick={(e) => {
              e.stopPropagation();
              if (onSpinStart && !spinning && !disabled) {
                onSpinStart();
              }
            }}
            className={`pointer-events-auto relative w-20 h-20 rounded-full flex flex-col items-center justify-center text-white font-black text-xs sm:text-sm tracking-wider uppercase transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.5)] active:scale-95 focus:outline-none ${
              spinning || disabled
                ? "bg-gradient-to-tr from-gray-700 to-gray-500 cursor-not-allowed opacity-80"
                : "bg-gradient-to-tr from-rose-500 via-pink-600 to-purple-600 hover:scale-105 hover:shadow-[0_0_25px_rgba(244,63,94,0.8)] cursor-pointer ring-2 ring-yellow-300 animate-pulse"
            }`}
          >
            {spinning ? (
              <span className="text-[11px] font-bold">Spinning...</span>
            ) : (
              <>
                <span className="text-[10px] text-yellow-200 font-bold">LUCKY</span>
                <span className="text-sm font-extrabold drop-shadow">SPIN</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

