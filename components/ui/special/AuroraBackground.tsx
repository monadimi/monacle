/**
 * @file components/ui/special/AuroraBackground.tsx
 * @purpose Renders an animated aurora background effect.
 * @scope Visual background decoration.
 * @out-of-scope Layout, Content.
 */
"use client";

import React from "react";

export const AuroraBackground = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#fafafc] pointer-events-none">
      {/* Optimized Blobs using standard CSS classes for simpler renders */}
      <div
        className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-yellow-100/60 rounded-full blur-[80px] animate-[pulse_10s_ease-in-out_infinite] opacity-60"
        style={{ willChange: 'transform, opacity' }}
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-slate-200/40 rounded-full blur-[80px] animate-[pulse_12s_ease-in-out_infinite_reverse] opacity-60"
        style={{ willChange: 'transform, opacity' }}
      />
      <div
        className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] bg-orange-50/50 rounded-full blur-[60px] animate-[pulse_15s_ease-in-out_infinite] opacity-40"
        style={{ willChange: 'transform, opacity' }}
      />
      <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px]" />
    </div>
  );
};
