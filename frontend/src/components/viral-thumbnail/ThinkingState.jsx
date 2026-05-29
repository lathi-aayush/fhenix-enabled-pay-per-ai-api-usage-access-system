import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { THINKING_MESSAGES } from "./constants.js";

export default function ThinkingState({ longRunning = false }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % THINKING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-md border border-surface-variant bg-gradient-to-br from-slate-50 to-white p-8 text-center">
      <motion.div
        className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-[#031634]/20 border-t-[#031634]"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      />
      <AnimatePresence mode="wait">
        <motion.p
          key={idx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="text-sm font-medium text-primary"
        >
          {THINKING_MESSAGES[idx]}
        </motion.p>
      </AnimatePresence>
      <p className="text-[11px] text-on-surface-variant mt-2">
        Gemini · strategy + 16:9 image preview
        {longRunning ? " · may take up to a minute" : ""}
      </p>
    </div>
  );
}
