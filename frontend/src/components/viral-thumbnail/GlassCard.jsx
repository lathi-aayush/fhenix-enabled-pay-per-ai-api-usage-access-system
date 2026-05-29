import React from "react";
import { motion } from "framer-motion";

export default function GlassCard({ title, icon, children, className = "", delay = 0, actions }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`relative rounded-md border border-surface-variant bg-white/90 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-shadow ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#031634]/20 to-transparent" />
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="material-symbols-outlined text-[#031634] text-lg">{icon}</span>
          )}
          <h3 className="text-sm font-semibold text-primary">{title}</h3>
        </div>
        {actions}
      </div>
      {children}
    </motion.div>
  );
}

export function ShimmerBlock({ className = "h-20" }) {
  return <div className={`rounded-md bg-slate-100 animate-pulse ${className}`} />;
}

export function ScoreBar({ label, value }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-mono font-semibold text-[#031634]">{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-[#031634] to-slate-600"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
