import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const APIS = [
  { name: "Text Completion", model: "DeepSeek V3", icon: "chat", color: "bg-indigo-100 text-indigo-600" },
  { name: "Image Generation", model: "Stable Diffusion", icon: "image", color: "bg-violet-100 text-violet-600" },
  { name: "Speech-to-Text", model: "Whisper Large", icon: "graphic_eq", color: "bg-emerald-100 text-emerald-600" },
  { name: "Code Assistant", model: "Llama 3.3", icon: "code", color: "bg-amber-100 text-amber-600" },
  { name: "Embedding", model: "Nomic Embed", icon: "hub", color: "bg-cyan-100 text-cyan-600" },
  { name: "Sentiment Analysis", model: "Groq Inference", icon: "psychology", color: "bg-rose-100 text-rose-600" },
  { name: "Summarization", model: "Mixtral 8x7B", icon: "summarize", color: "bg-fuchsia-100 text-fuchsia-600" },
];

function randomAddr() {
  const hex = "0123456789ABCDEF";
  const part = (n) => Array.from({ length: n }, () => hex[Math.floor(Math.random() * 16)]).join("");
  return `${part(4)}...${part(4)}`;
}

function randomAlgo() {
  return (Math.random() * 0.009 + 0.001).toFixed(4);
}

function randomTimestamp() {
  const secs = Math.floor(Math.random() * 59) + 1;
  return `${secs}s ago`;
}

let idCounter = 100;
function makeEntry() {
  const api = APIS[Math.floor(Math.random() * APIS.length)];
  return {
    id: ++idCounter,
    from: randomAddr(),
    to: randomAddr(),
    api: api.name,
    model: api.model,
    icon: api.icon,
    color: api.color,
    algo: randomAlgo(),
    block: Math.floor(Math.random() * 1000000 + 44000000),
    age: "just now",
    status: "confirmed",
  };
}

const INITIAL = Array.from({ length: 5 }, () => {
  const e = makeEntry();
  e.age = randomTimestamp();
  return e;
});

export default function LiveTxFeed() {
  const [entries, setEntries] = useState(INITIAL);
  const tickRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current++;
      // Age existing entries
      setEntries((prev) => {
        const newEntry = makeEntry();
        const aged = prev.slice(0, 5).map((e, i) => {
          const sec = (i + 1) * 3 + tickRef.current;
          return { ...e, age: sec < 60 ? `${sec}s ago` : `${Math.floor(sec / 60)}m ago` };
        });
        return [newEntry, ...aged];
      });
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full max-w-md ml-auto">
      {/* Widget header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse [animation-delay:0.4s]" />
            <div className="w-2.5 h-2.5 rounded-full bg-violet-400 animate-pulse [animation-delay:0.8s]" />
          </div>
          <span className="text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase">
            Live On-Chain Transactions
          </span>
        </div>
        <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
          Algorand TestNet
        </span>
      </div>

      {/* Feed card */}
      <div
        className="bg-white/70 backdrop-blur-xl border border-slate-200/70 rounded-2xl overflow-hidden shadow-xl shadow-slate-200/60"
        style={{ minHeight: 340 }}
      >
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 text-[9px] font-bold tracking-[0.14em] text-slate-400 uppercase">
          <span>API Call</span>
          <span className="text-right">ALGO</span>
          <span className="text-right pr-1">Block</span>
        </div>

        {/* Entries */}
        <div className="divide-y divide-slate-100/80 overflow-hidden h-[336px]">
          <AnimatePresence initial={false}>
            {entries.slice(0, 6).map((e) => (
              <motion.div
                key={e.id}
                layout
                initial={{ opacity: 0, height: 0, scale: 0.96, y: -8, backgroundColor: "rgba(99, 102, 241, 0.05)" }}
                animate={{ opacity: 1, height: 56, scale: 1, y: 0, backgroundColor: "rgba(255, 255, 255, 0)" }}
                exit={{ opacity: 0, height: 0, scale: 0.96, y: 8 }}
                transition={{
                  duration: 0.45,
                  ease: [0.16, 1, 0.3, 1]
                }}
                className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-3 items-center origin-top overflow-hidden"
              >
                {/* Left: icon + api + addresses */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`shrink-0 w-7 h-7 rounded-lg ${e.color} flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-[14px]">{e.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-800 truncate">{e.api}</p>
                    <p className="text-[9px] text-slate-400 font-mono">
                      {e.from} → {e.to}
                    </p>
                  </div>
                </div>

                {/* Algo amount */}
                <div className="text-right">
                  <p className="text-[11px] font-bold text-emerald-600 font-mono">
                    {e.algo}
                  </p>
                  <p className="text-[9px] text-slate-400">{e.age}</p>
                </div>

                {/* Block / confirmed */}
                <div className="text-right pr-1">
                  <p className="text-[9px] text-slate-400 font-mono">{e.block.toLocaleString()}</p>
                  <p className="text-[9px] text-emerald-500 font-semibold">✓ confirmed</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[9px] text-slate-400">Simulated for demonstration</p>
          <p className="text-[9px] font-semibold text-indigo-500">
            avg 0.003 ALGO / call
          </p>
        </div>
      </div>

      {/* Decorative glow behind the card */}
      <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-indigo-200/30 via-violet-100/20 to-emerald-200/20 blur-2xl" />
    </div>
  );
}
