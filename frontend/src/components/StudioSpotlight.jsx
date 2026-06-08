import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TOOLS = [
  {
    id: "blog",
    label: "Blog Writer",
    icon: "edit_note",
    color: "emerald",
    tagline: "Go from idea to polished post in seconds",
    desc: "Type a topic, pick a tone, and SentinalAI drafts a full SEO-optimised article — intro, headers, body, and CTA — powered by your choice of LLM, billed per word generated.",
    badges: ["DeepSeek V3", "Markdown export", "SEO hints", "Tone control"],
    preview: {
      type: "blog",
      title: "10 Ways Blockchain Is Reshaping AI Monetization",
      excerpt:
        "The intersection of decentralised infrastructure and artificial intelligence is creating a new economic model where developers earn directly for every inference call, without a middleman…",
      meta: "Draft · 847 words · 0.0032 ALGO charged",
    },
  },
  {
    id: "video",
    label: "Video Editor",
    icon: "movie_edit",
    color: "violet",
    tagline: "Cut, caption, and remix AI-generated video",
    desc: "Upload raw footage or generate from a prompt. Add auto-captions, background music, and scene transitions. Each rendering job is priced transparently in ALGO — no monthly seat fees.",
    badges: ["Auto-captions", "Scene detection", "Text overlays", "ALGO billing"],
    preview: {
      type: "video",
      title: "Product Demo — Sentinal API Walkthrough",
      meta: "Rendering · 2m 14s · 0.0089 ALGO charged",
      scenes: ["Intro", "API Call Demo", "Wallet Payment", "Outro"],
    },
  },
  {
    id: "analyst",
    label: "Data Analyst",
    icon: "query_stats",
    color: "indigo",
    tagline: "Ask questions, get charts and insights instantly",
    desc: "Upload a CSV or connect a data source and ask plain-English questions. The AI runs analysis, produces visualisations, and writes an executive summary — fully logged on-chain.",
    badges: ["CSV / JSON", "Auto charts", "SQL queries", "On-chain log"],
    preview: {
      type: "analyst",
      title: "API Usage Analysis — May 2025",
      meta: "Analysis complete · 0.0018 ALGO charged",
      stats: [
        { label: "Total calls", value: "14,892" },
        { label: "Revenue (ALGO)", value: "124.77" },
        { label: "Top API", value: "Text Completion" },
        { label: "Avg latency", value: "320 ms" },
      ],
    },
  },
];

const COLOR = {
  emerald: {
    badge: "bg-emerald-50 border-emerald-200/60 text-emerald-700",
    icon: "bg-emerald-50 border-emerald-100 text-emerald-600",
    tab: "border-emerald-500 text-emerald-700",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    caret: "text-emerald-500",
    glow: "from-emerald-200/30 to-transparent",
    ring: "ring-emerald-200",
  },
  violet: {
    badge: "bg-violet-50 border-violet-200/60 text-violet-700",
    icon: "bg-violet-50 border-violet-100 text-violet-600",
    tab: "border-violet-500 text-violet-700",
    pill: "bg-violet-50 text-violet-700 border-violet-200/60",
    caret: "text-violet-500",
    glow: "from-violet-200/30 to-transparent",
    ring: "ring-violet-200",
  },
  indigo: {
    badge: "bg-indigo-50 border-indigo-200/60 text-indigo-700",
    icon: "bg-indigo-50 border-indigo-100 text-indigo-600",
    tab: "border-indigo-500 text-indigo-700",
    pill: "bg-indigo-50 text-indigo-700 border-indigo-200/60",
    caret: "text-indigo-500",
    glow: "from-indigo-200/30 to-transparent",
    ring: "ring-indigo-200",
  },
};

function BlogPreview({ data, color }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${COLOR[color].icon}`}>
          <span className="material-symbols-outlined text-[16px]">edit_note</span>
        </div>
        <div>
          <p className="text-[13px] font-bold text-slate-800 leading-tight">{data.title}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{data.meta}</p>
        </div>
      </div>
      <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3">
        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-4">{data.excerpt}</p>
      </div>
      <div className="flex gap-1.5 flex-wrap mt-1">
        {["Introduction", "Section 1", "Section 2", "Conclusion", "CTA"].map((s) => (
          <span key={s} className="text-[9px] font-semibold bg-emerald-50 border border-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function VideoPreview({ data, color }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${COLOR[color].icon}`}>
          <span className="material-symbols-outlined text-[16px]">movie_edit</span>
        </div>
        <div>
          <p className="text-[13px] font-bold text-slate-800 leading-tight">{data.title}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{data.meta}</p>
        </div>
      </div>
      {/* Fake timeline */}
      <div className="bg-slate-800/90 rounded-xl p-3 flex flex-col gap-2">
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full w-2/3 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full" />
        </div>
        <div className="flex gap-1.5">
          {data.scenes.map((s, i) => (
            <div key={s} className={`flex-1 rounded-lg px-1.5 py-2 text-[8px] font-bold text-center ${i === 1 ? "bg-violet-500/80 text-white" : "bg-slate-700/60 text-slate-400"}`}>
              {s}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-400">0:58 / 2:14</span>
          <div className="flex gap-1">
            {["skip_previous", "pause", "skip_next"].map((ic) => (
              <span key={ic} className="material-symbols-outlined text-slate-400 text-[14px] cursor-pointer hover:text-white transition-colors">{ic}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalystPreview({ data, color }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center ${COLOR[color].icon}`}>
          <span className="material-symbols-outlined text-[16px]">query_stats</span>
        </div>
        <div>
          <p className="text-[13px] font-bold text-slate-800 leading-tight">{data.title}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{data.meta}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {data.stats.map((s) => (
          <div key={s.label} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
            <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">{s.label}</p>
            <p className="text-[15px] font-extrabold text-slate-800 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>
      {/* Fake bar chart */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-2">API calls this week</p>
        <div className="flex items-end gap-1.5 h-10">
          {[40, 65, 55, 80, 90, 60, 75].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-gradient-to-t from-indigo-400 to-indigo-300"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="text-[8px] text-slate-400 flex-1 text-center">{d}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StudioSpotlight({ onEnter }) {
  const [active, setActive] = useState("blog");
  const tool = TOOLS.find((t) => t.id === active);
  const c = COLOR[tool.color];

  return (
    <section className="max-w-6xl mx-auto px-6 py-20 relative z-10">
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.18em] uppercase px-3 py-1.5 rounded-full border mb-4 ${c.badge}`}>
          <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
          AI Studio
        </span>
        <h2 className="font-headline text-3xl md:text-4xl font-extrabold text-slate-900 mt-2 leading-tight">
          Create anything.<br />
          <span className="bg-gradient-to-r from-emerald-500 via-violet-500 to-indigo-500 bg-clip-text text-transparent">
            Pay only for what you use.
          </span>
        </h2>
        <p className="text-slate-500 text-base mt-4 max-w-xl mx-auto leading-relaxed">
          The Studio gives creators a full AI-powered workspace — blog writing, video editing, and data analytics — all billed transparently per task in micro-ALGO.
        </p>
      </motion.div>

      {/* Tab selectors */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex justify-center gap-2 mb-8"
      >
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold transition-all duration-200 border ${
              active === t.id
                ? `${COLOR[t.color].badge} shadow-sm`
                : "bg-white/60 text-slate-500 border-slate-200/70 hover:border-slate-300"
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </motion.div>

      {/* Main panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="grid md:grid-cols-[1fr_1fr] gap-6 items-stretch"
        >
          {/* Left: description */}
          <div className="bg-white/70 backdrop-blur-md border border-slate-200/70 rounded-2xl p-7 flex flex-col gap-5 relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl ${c.glow} rounded-full blur-2xl pointer-events-none`} />

            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${c.icon}`}>
              <span className="material-symbols-outlined text-[22px]">{tool.icon}</span>
            </div>

            <div>
              <p className={`text-[10px] font-bold tracking-[0.15em] uppercase mb-1 ${c.caret}`}>{tool.label}</p>
              <h3 className="font-headline text-xl font-extrabold text-slate-900">{tool.tagline}</h3>
              <p className="text-sm text-slate-500 mt-3 leading-relaxed">{tool.desc}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {tool.badges.map((b) => (
                <span key={b} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${c.pill}`}>
                  {b}
                </span>
              ))}
            </div>

            <div className="mt-auto pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={onEnter}
                className="group flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-indigo-600 transition-colors"
              >
                Open Studio
                <span className="material-symbols-outlined text-[17px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* Right: live preview mockup */}
          <div className="bg-white/80 backdrop-blur-md border border-slate-200/70 rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden shadow-lg shadow-slate-200/40">
            {/* Fake browser chrome */}
            <div className="flex items-center gap-1.5 pb-3 border-b border-slate-100">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-300" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-300" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
              <div className="ml-3 flex-1 bg-slate-100 rounded-md h-5 px-2 flex items-center">
                <span className="text-[9px] text-slate-400">sentinel.ai/studio/{tool.id}</span>
              </div>
            </div>

            {tool.id === "blog" && <BlogPreview data={tool.preview} color={tool.color} />}
            {tool.id === "video" && <VideoPreview data={tool.preview} color={tool.color} />}
            {tool.id === "analyst" && <AnalystPreview data={tool.preview} color={tool.color} />}

            {/* ALGO cost pill */}
            <div className="mt-auto flex items-center gap-2 bg-emerald-50/80 border border-emerald-200/50 rounded-xl px-3 py-2">
              <span className="material-symbols-outlined text-emerald-500 text-[16px]">toll</span>
              <span className="text-[11px] font-semibold text-emerald-700">Transparent on-chain billing · no monthly fee</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom CTA strip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl px-7 py-5"
      >
        <div>
          <p className="font-headline font-bold text-white text-lg">Ready to create?</p>
          <p className="text-slate-400 text-sm mt-0.5">Connect your Pera Wallet and start for free — you only pay when you generate.</p>
        </div>
        <button
          type="button"
          onClick={onEnter}
          className="group shrink-0 flex items-center gap-2 px-6 py-3 bg-emerald-400 hover:bg-emerald-300 text-slate-900 font-bold rounded-full text-sm transition-all duration-200 hover:shadow-lg hover:shadow-emerald-400/30 hover:-translate-y-0.5"
        >
          Open AI Studio
          <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">auto_awesome</span>
        </button>
      </motion.div>
    </section>
  );
}
