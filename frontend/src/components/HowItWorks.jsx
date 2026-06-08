import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";

/* ── tiny hook: fires once when element enters viewport ── */
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

/* ── animated counter (re-runs when live stats update) ── */
function Counter({ to, suffix = "", duration = 1800 }) {
  const [val, setVal] = useState(0);
  const [ref, visible] = useInView();
  useEffect(() => {
    if (!visible || to <= 0) return;
    let start = null;
    let raf = 0;
    const from = val;
    const delta = to - from;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - (1 - p) ** 3;
      setVal(Math.floor(from + delta * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else setVal(to);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [visible, to, duration]);
  return (
    <span ref={ref}>
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}

const FALLBACK_STATS = [
  { label: "APIs Available", value: 0, suffix: "+" },
  { label: "On-chain Txns", value: 0, suffix: "+" },
  { label: "Avg Latency", value: 42, suffix: "ms" },
];

function useLivePlatformStats() {
  const [stats, setStats] = useState(FALLBACK_STATS);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get("/api/contract/stats");
        const h = data?.homepage;
        const apis = Math.max(0, Number(h?.apisAvailable) || 0);
        const txns = Math.max(0, Number(h?.onChainTxns) || 0);
        const ms = Math.max(1, Number(h?.avgLatencyMs) || 42);
        setStats([
          { label: "APIs Available", value: apis, suffix: "+" },
          { label: "On-chain Txns", value: txns, suffix: "+" },
          { label: "Avg Latency", value: ms, suffix: "ms" },
        ]);
      } catch {
        /* keep last good values */
      }
    }
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  return stats;
}

/* ── Marketplace steps ── */
const marketplaceSteps = [
  {
    icon: "storefront",
    color: "#031634",
    bg: "from-[#031634]/10 to-[#031634]/5",
    border: "border-[#031634]/20",
    title: "Browse the Marketplace",
    desc: "Discover hundreds of AI APIs — image generation, NLP, speech, and more — published by verified creators.",
    pill: "Step 1",
    pillColor: "bg-[#031634] text-white",
    link: "/marketplace/browse",
  },
  {
    icon: "account_balance_wallet",
    color: "#059669",
    bg: "from-emerald-500/10 to-emerald-400/5",
    border: "border-emerald-500/20",
    title: "Connect Pera Wallet",
    desc: "Link your Algorand Pera Wallet in one click. No credit card. No subscription. Just ALGO.",
    pill: "Step 2",
    pillColor: "bg-emerald-600 text-white",
    videoEmbed: "https://www.youtube.com/embed/m720vHR8g1U?si=SmBaluRmj19-_yO2&start=57",
    videoUrl: "https://youtu.be/m720vHR8g1U?si=-n0sLN5b0sqMuLBk&t=57",
  },
  {
    icon: "bolt",
    color: "#7C3AED",
    bg: "from-violet-500/10 to-violet-400/5",
    border: "border-violet-500/20",
    title: "Call an API Instantly",
    desc: "Send a request. Our backend meters every token. Each call deducts micro-ALGO directly to the creator's wallet — no middleman.",
    pill: "Step 3",
    pillColor: "bg-violet-600 text-white",
  },
  {
    icon: "receipt_long",
    color: "#DB6B1B",
    bg: "from-orange-500/10 to-orange-400/5",
    border: "border-orange-500/20",
    title: "View Live Billing",
    desc: "See every transaction on-chain via Algorand TestNet. Full transparency. Zero hidden fees.",
    pill: "Step 4",
    pillColor: "bg-orange-600 text-white",
  },
];

/* ── Studio steps ── */
const studioSteps = [
  {
    icon: "edit_note",
    color: "#4F46E5",
    title: "Describe Your Content",
    desc: "Tell the AI Blog Agent your topic, tone, and audience. Our Groq-powered model drafts a full article in seconds via real-time streaming.",
  },
  {
    icon: "tune",
    color: "#0891B2",
    title: "Edit & Refine",
    desc: "Tweak headings, regenerate sections, adjust style. Everything auto-saves to your project drafts.",
  },
  {
    icon: "schedule",
    color: "#7C3AED",
    title: "Schedule Publishing",
    desc: "Pick a date and platforms — Hashnode, Dev.to, Medium. Our BullMQ worker handles queued publishing behind the scenes.",
  },
  {
    icon: "bar_chart",
    color: "#059669",
    title: "Track Analytics",
    desc: "Monitor post performance, platform reach, and AI usage across all your Studio projects in one dashboard.",
  },
];

/* ── Flow arrow connector ── */
function FlowArrow({ visible, delay }) {
  return (
    <div
      className="hidden md:flex items-center justify-center flex-shrink-0 w-10"
      style={{ opacity: visible ? 1 : 0, transform: visible ? "scaleX(1)" : "scaleX(0)", transition: `opacity 0.4s ${delay}s, transform 0.4s ${delay}s` }}
    >
      <div className="relative w-full flex items-center">
        <div className="h-[2px] w-full bg-gradient-to-r from-slate-300 to-slate-400 rounded-full" />
        <span className="material-symbols-outlined absolute right-0 text-slate-400 text-base -mr-1">arrow_forward</span>
      </div>
    </div>
  );
}

const VIDEO_HOVER_MIN_MS = 2000;

/* ── Marketplace card ── */
function MarketplaceCard({ step, index, visible }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const hoverStartedAt = useRef(null);
  const hideTimer = useRef(null);
  const delay = 0.1 + index * 0.15;
  const hasVideo = Boolean(step.videoEmbed);
  const hasLink = Boolean(step.link);
  const isClickable = hasVideo || hasLink;

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  function showVideoPopover() {
    if (!hasVideo) return;
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (!hoverStartedAt.current) hoverStartedAt.current = Date.now();
    setHovered(true);
  }

  function hideVideoPopover() {
    if (!hasVideo) return;
    const elapsed = Date.now() - (hoverStartedAt.current || 0);
    const remaining = Math.max(0, VIDEO_HOVER_MIN_MS - elapsed);
    hideTimer.current = setTimeout(() => {
      setHovered(false);
      hoverStartedAt.current = null;
      hideTimer.current = null;
    }, remaining);
  }

  function openVideo() {
    if (step.videoUrl) window.open(step.videoUrl, "_blank", "noopener,noreferrer");
  }

  function handleClick() {
    if (hasVideo) openVideo();
    else if (hasLink) navigate(step.link);
  }

  return (
    <div
      className="relative flex-1 min-w-[200px]"
      onMouseEnter={showVideoPopover}
      onMouseLeave={hideVideoPopover}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
      role={isClickable ? "link" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.55s ${delay}s ease, transform 0.55s ${delay}s ease`,
      }}
    >
      {hasVideo && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-50 w-[min(300px,calc(100vw-2rem))] transition-all duration-300 top-[calc(100%+12px)] md:top-auto md:bottom-[calc(100%+12px)] ${
            hovered
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-2 pointer-events-none"
          }`}
          aria-hidden={!hovered}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-2xl border-2 border-emerald-500 overflow-hidden shadow-2xl shadow-emerald-500/20 bg-white">
            <div className="aspect-video w-full">
              <iframe
                className="w-full h-full"
                src={step.videoEmbed}
                title="Connect Pera Wallet demo"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      <div
        className={`h-full rounded-2xl bg-gradient-to-br ${step.bg} border ${step.border} p-5 flex flex-col gap-3 group hover:-translate-y-1 hover:shadow-xl transition-all duration-300 ${
          isClickable ? "cursor-pointer" : "cursor-default"
        }`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${step.pillColor}`}
          >
            {step.pill}
          </span>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `${step.color}15` }}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ color: step.color }}>
              {step.icon}
            </span>
          </div>
        </div>
        <h4 className="font-headline font-bold text-slate-900 text-[15px] leading-snug group-hover:text-opacity-80 transition-colors">
          {step.title}
        </h4>
        <p className="text-[12px] text-slate-500 leading-relaxed">{step.desc}</p>
      </div>
    </div>
  );
}

/* ── Studio timeline item ── */
function StudioTimelineItem({ step, index, visible }) {
  const delay = 0.1 + index * 0.18;
  const isEven = index % 2 === 0;
  return (
    <div
      className="flex items-start gap-4"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : `translateX(${isEven ? -28 : 28}px)`,
        transition: `opacity 0.55s ${delay}s ease, transform 0.55s ${delay}s ease`,
      }}
    >
      {/* timeline dot */}
      <div className="flex flex-col items-center flex-shrink-0 pt-1">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shadow-md ring-4 ring-white"
          style={{ background: `${step.color}18`, border: `2px solid ${step.color}40` }}
        >
          <span className="material-symbols-outlined text-[18px]" style={{ color: step.color }}>
            {step.icon}
          </span>
        </div>
        {index < studioSteps.length - 1 && (
          <div className="w-[2px] flex-1 min-h-[32px] mt-2 bg-gradient-to-b from-slate-200 to-transparent rounded-full" />
        )}
      </div>

      {/* content */}
      <div className="pb-8 group hover:-translate-y-0.5 transition-transform duration-200 cursor-default">
        <h4 className="font-headline font-bold text-slate-900 text-[15px] leading-snug">
          {step.title}
        </h4>
        <p className="text-[12px] text-slate-500 leading-relaxed mt-1 max-w-xs">{step.desc}</p>
      </div>
    </div>
  );
}

/* ── Live API Demo mini-widget ── */
function LiveApiDemo({ visible }) {
  const [active, setActive] = useState(false);
  const [lines, setLines] = useState([]);
  const mockLines = [
    { t: 0,   txt: '> POST /api/use/image-gen', c: "text-slate-400" },
    { t: 400, txt: '  Authorization: Bearer ••••jwt••••', c: "text-yellow-400" },
    { t: 800, txt: '  { "prompt": "astronaut on mars" }', c: "text-slate-300" },
    { t: 1200, txt: '← 200 OK  |  tokens: 842  |  cost: 0.0012 ALGO', c: "text-emerald-400" },
    { t: 1600, txt: '← on-chain txn: HX8T…K2J confirmed ✓', c: "text-blue-400" },
  ];

  function run() {
    if (active) return;
    setActive(true);
    setLines([]);
    mockLines.forEach(({ t, txt, c }) => {
      setTimeout(() => setLines(prev => [...prev, { txt, c }]), t);
    });
    setTimeout(() => setActive(false), 2200);
  }

  return (
    <div
      className="rounded-2xl bg-[#0D1117] border border-slate-700/50 overflow-hidden shadow-2xl"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.95)",
        transition: "opacity 0.6s 0.3s ease, transform 0.6s 0.3s ease",
      }}
    >
      {/* terminal bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#161B22] border-b border-slate-700/50">
        <div className="w-3 h-3 rounded-full bg-rose-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
        <span className="ml-3 text-[11px] font-mono text-slate-400">sentinel-api-demo</span>
        <button
          onClick={run}
          disabled={active}
          className="ml-auto text-[10px] font-bold px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
        >
          {active ? "running…" : "▶ Run"}
        </button>
      </div>
      {/* output */}
      <div className="px-4 py-4 font-mono text-[11px] min-h-[130px] flex flex-col gap-1.5">
        {lines.length === 0 && !active && (
          <span className="text-slate-600 italic">Click ▶ Run to simulate an API call…</span>
        )}
        {lines.map((l, i) => (
          <span key={i} className={`${l.c} animate-[fadeInUp_0.25s_ease_both]`}>{l.txt}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Main export ── */
export default function HowItWorks() {
  const liveStats = useLivePlatformStats();

  const [sectionRef, sectionVisible] = useInView(0.05);
  const [marketRef, marketVisible] = useInView(0.1);
  const [studioRef, studioVisible] = useInView(0.1);
  const [demoRef, demoVisible] = useInView(0.1);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="max-w-[1100px] mx-auto px-8 py-24 flex flex-col gap-24"
    >
      {/* ── Section header ── */}
      <div
        className="flex flex-col items-center text-center gap-4"
        style={{
          opacity: sectionVisible ? 1 : 0,
          transform: sectionVisible ? "translateY(0)" : "translateY(24px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        <span className="text-[11px] font-bold tracking-[0.15em] text-violet-600 uppercase bg-violet-50 px-4 py-1.5 rounded-full border border-violet-100">
          How It Works
        </span>
        <h2 className="font-headline text-4xl md:text-5xl font-bold text-slate-900 leading-tight tracking-tight">
          Two powerful products.<br />
          <span className="bg-gradient-to-r from-[#031634] via-violet-700 to-indigo-500 bg-clip-text text-transparent">
            One unified platform.
          </span>
        </h2>
        <p className="text-slate-500 text-base max-w-xl leading-relaxed">
          SentinalAI combines a decentralized <strong className="text-slate-700">API Marketplace</strong> powered by Algorand payments with an AI-first <strong className="text-slate-700">Studio</strong> for content creators.
        </p>

        {/* animated stats */}
        <div
          className="flex flex-wrap justify-center gap-8 mt-4 pt-6 border-t border-slate-100 w-full max-w-lg"
          style={{ opacity: sectionVisible ? 1 : 0, transition: "opacity 0.8s 0.4s" }}
        >
          {liveStats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className="font-headline text-2xl font-bold text-[#031634]">
                <Counter to={s.value} suffix={s.suffix} />
              </span>
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════ MARKETPLACE ══════════ */}
      <div ref={marketRef} className="flex flex-col gap-8">
        {/* heading */}
        <div
          className="flex items-center gap-4"
          style={{
            opacity: marketVisible ? 1 : 0,
            transform: marketVisible ? "translateX(0)" : "translateX(-20px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <div className="w-10 h-10 rounded-xl bg-[#031634] flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-white text-[20px]">api</span>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] text-[#031634] uppercase">For Developers & Users</p>
            <h3 className="font-headline text-2xl font-bold text-slate-900">API Marketplace</h3>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2 text-[11px] text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Algorand TestNet Live
          </div>
        </div>

        {/* step cards + arrows */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch">
          {marketplaceSteps.map((step, i) => (
            <div key={i} className="flex flex-col md:flex-row items-stretch flex-1 gap-3">
              <MarketplaceCard step={step} index={i} visible={marketVisible} />
              {i < marketplaceSteps.length - 1 && (
                <FlowArrow visible={marketVisible} delay={0.1 + i * 0.15} />
              )}
            </div>
          ))}
        </div>

        {/* live demo terminal */}
        <div ref={demoRef}>
          <div
            style={{
              opacity: demoVisible ? 1 : 0,
              transform: demoVisible ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 0.5s 0.15s ease, transform 0.5s 0.15s ease",
            }}
          >
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]">terminal</span>
              Live API Call Simulation
            </p>
            <LiveApiDemo visible={demoVisible} />
          </div>
        </div>
      </div>

      {/* ══════════ STUDIO ══════════ */}
      <div ref={studioRef} className="flex flex-col gap-8">
        {/* heading */}
        <div
          className="flex items-center gap-4"
          style={{
            opacity: studioVisible ? 1 : 0,
            transform: studioVisible ? "translateX(0)" : "translateX(-20px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-white text-[20px]">auto_awesome</span>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] text-indigo-600 uppercase">For Content Creators</p>
            <h3 className="font-headline text-2xl font-bold text-slate-900">AI Studio</h3>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2 text-[11px] text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full">
            <span className="material-symbols-outlined text-[14px] text-indigo-500">memory</span>
            Groq-Powered Streaming
          </div>
        </div>

        {/* two-column layout */}
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* left: timeline */}
          <div className="flex flex-col">
            {studioSteps.map((step, i) => (
              <StudioTimelineItem key={i} step={step} index={i} visible={studioVisible} />
            ))}
          </div>

          {/* right: features grid */}
          <div
            className="grid grid-cols-1 gap-4"
            style={{
              opacity: studioVisible ? 1 : 0,
              transform: studioVisible ? "translateX(0)" : "translateX(28px)",
              transition: "opacity 0.6s 0.3s ease, transform 0.6s 0.3s ease",
            }}
          >
            {/* Blog Agent card */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-5 hover:shadow-lg transition-all duration-300 group cursor-default">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-indigo-600 text-[18px]">edit_document</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-[14px]">Blog Agent</h4>
                  <p className="text-[11px] text-slate-500">Groq LLM · SSE streaming · Markdown output</p>
                </div>
              </div>
              <div className="bg-white/80 rounded-xl p-3 border border-indigo-100 font-mono text-[11px] text-slate-600">
                <span className="text-indigo-500">AI </span>generating post<span className="inline-block w-1.5 h-3.5 bg-indigo-500 ml-0.5 align-middle animate-[blink_1s_step-end_infinite]" />
              </div>
            </div>

            {/* Publishing card */}
            <div className="rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-100 p-5 hover:shadow-lg transition-all duration-300 group cursor-default">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-cyan-600 text-[18px]">send</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-[14px]">Multi-Platform Publishing</h4>
                  <p className="text-[11px] text-slate-500">Hashnode · Dev.to · Medium</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {["Hashnode", "Dev.to", "Medium"].map((p) => (
                  <span key={p} className="text-[10px] font-semibold bg-white border border-cyan-100 text-cyan-700 px-2.5 py-1 rounded-full">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Queue card */}
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 p-5 hover:shadow-lg transition-all duration-300 group cursor-default">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">queue</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-[14px]">BullMQ Job Queue</h4>
                  <p className="text-[11px] text-slate-500">Redis-backed · async · scheduled publishing</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


    </section>
  );
}
