/**
 * @file components/ui/special/HighlightText.tsx
 * @purpose Renders text with shimmering highlight effect for bold parts.
 * @scope Text rendering and animation.
 */
"use client";

import React from "react";
import { motion } from "framer-motion";

export const HighlightText = ({ text }: { text: string }) => {
  const parts = text.split(/(\*\*.*?\*\*)/);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const content = part.slice(2, -2);
          return (
            <motion.span
              key={i}
              className="relative inline-block font-bold text-slate-900"
              initial={{ backgroundPosition: "200% center" }}
              animate={{ backgroundPosition: "-200% center" }}
              transition={{
                repeat: Infinity,
                duration: 3,
                ease: "linear"
              }}
              style={{
                backgroundImage: "linear-gradient(90deg, #1e293b 0%, #94a3b8 50%, #1e293b 100%)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                color: "transparent"
              }}
            >
              {content}
            </motion.span>
          );
        }
        return part;
      })}
    </span>
  );
};
