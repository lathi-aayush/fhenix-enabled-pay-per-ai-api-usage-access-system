import React from "react";

const TEMPLATES = [
  {
    title: "Competitive analysis",
    category: "Research",
    icon: "analytics",
    description: "Turn feature bullets into a structured market comparison report",
    chain: ["text"],
    prompt:
      "Analyze these product differentiators and write a competitive analysis report with strengths, gaps, and positioning:\n\n- Protected proxy layer\n- Billing complexity\n- Automated payments\n- No analytics\n- Usage dashboard",
  },
  {
    title: "Product launch kit",
    category: "Marketing",
    icon: "rocket_launch",
    description: "Script â†’ hero images â†’ cinematic launch video",
    chain: ["text", "image", "video"],
    prompt:
      "Create a product launch kit for a pay-per-use AI API marketplace on Base Sepolia: launch script, 3 hero keyframes, and a 20-second cinematic promo video",
  },
  {
    title: "Brand mood board",
    category: "Creative",
    icon: "palette",
    description: "Creative brief â†’ styled image series",
    chain: ["text", "image"],
    prompt:
      "Generate a brand mood board for a fintech AI gateway: deep navy + electric teal palette, glassmorphism UI, trust and speed themes â€” 4 cinematic 16:9 images",
  },
  {
    title: "Explainer video",
    category: "Video",
    icon: "movie",
    description: "Script â†’ keyframes â†’ motion clip with voiceover",
    chain: ["text", "image", "video", "audio"],
    prompt:
      "Write a 45-second explainer for how micropayments unlock AI APIs. Generate 3 storyboard frames, animate a cinematic clip, and narrate in a confident professional tone",
  },
  {
    title: "Podcast voiceover",
    category: "Audio",
    icon: "mic",
    description: "Script â†’ TTS narration",
    chain: ["text", "audio"],
    prompt:
      "Write and narrate a 2-minute podcast intro about why developers are moving from subscriptions to pay-per-use AI APIs",
  },
  {
    title: "Social campaign",
    category: "Marketing",
    icon: "campaign",
    description: "Copy + visual assets for a multi-post campaign",
    chain: ["text", "image"],
    prompt:
      "Create a 5-post LinkedIn campaign for a blockchain AI API marketplace. Include hook copy for each post and generate one bold hero image per post theme",
  },
  {
    title: "Pitch deck narrative",
    category: "Business",
    icon: "slideshow",
    description: "Investor-ready storyline with slide outlines",
    chain: ["text"],
    prompt:
      "Write an investor pitch deck narrative for Sentinel â€” a pay-per-use AI API gateway on Base Sepolia. Include problem, solution, market, business model, traction, and ask. Format as slide-by-slide outlines",
  },
  {
    title: "API docs draft",
    category: "Developer",
    icon: "code",
    description: "Generate developer documentation from a feature list",
    chain: ["text"],
    prompt:
      "Write developer documentation for a pay-per-use AI API with: authentication via API keys, x402 micropayments, streaming responses, and usage dashboards. Include quickstart, endpoints, and error codes",
  },
  {
    title: "Data automation",
    category: "Code",
    icon: "terminal",
    description: "Python script for a data task",
    chain: ["code"],
    prompt:
      "Write a Python script that reads API usage logs from a CSV, computes cost per endpoint, and outputs a summary report with charts saved as PNG",
  },
  {
    title: "Blog post",
    category: "Writing",
    icon: "article",
    description: "Research and write SEO content",
    chain: ["text"],
    prompt:
      "Write a comprehensive SEO blog post about pay-per-use AI APIs vs monthly subscriptions â€” include real-world use cases for indie developers and startups",
  },
  {
    title: "Wildlife cinematic",
    category: "Video",
    icon: "landscape",
    description: "Nature brief â†’ keyframes â†’ Veo motion clip",
    chain: ["text", "image", "video"],
    prompt:
      "A majestic eagle soaring over misty mountains at golden hour â€” write a cinematic script, generate 3 keyframes, and produce a slow-motion video clip",
  },
  {
    title: "Image series",
    category: "Creative",
    icon: "photo_library",
    description: "Creative brief â†’ styled image set",
    chain: ["text", "image"],
    prompt:
      "Generate a cinematic image series showing the journey of an AI request: wallet payment â†’ proxy gateway â†’ LLM response â†’ on-chain receipt. Cyberpunk fintech aesthetic",
  },
];

const CATEGORY_COLORS = {
  Research: "bg-violet-100 text-violet-800",
  Marketing: "bg-orange-100 text-orange-800",
  Creative: "bg-pink-100 text-pink-800",
  Video: "bg-indigo-100 text-indigo-800",
  Audio: "bg-teal-100 text-teal-800",
  Business: "bg-amber-100 text-amber-800",
  Developer: "bg-slate-100 text-slate-700",
  Code: "bg-emerald-100 text-emerald-800",
  Writing: "bg-blue-100 text-blue-800",
};

export default function Templates({ onUse }) {
  const inferRunType = (chain) => {
    if (chain.includes("video") && chain.includes("audio")) return "agentic_full";
    if (chain.includes("video")) return "agentic_video";
    if (chain.includes("image")) return "agentic_images";
    if (chain.includes("code")) return "agentic_text";
    return "agentic_text";
  };
  return (
    <div>
      <p className="text-sm text-on-surface-variant mb-4 max-w-2xl">
        Pick a starter prompt â€” the router picks the best agent chain (text, image, video, audio, code)
        automatically.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => (
          <div
            key={t.title}
            className="bg-white border border-surface-variant rounded-md p-4 flex flex-col gap-2 hover:border-[#031634]/20 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="material-symbols-outlined text-[#031634] text-xl">{t.icon}</span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${CATEGORY_COLORS[t.category] || "bg-slate-100 text-slate-700"}`}
              >
                {t.category}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {t.chain.map((c) => (
                <span
                  key={c}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                >
                  {c}
                </span>
              ))}
            </div>
            <h3 className="text-sm font-semibold text-primary">{t.title}</h3>
            <p className="text-xs text-on-surface-variant flex-1">{t.description}</p>
            <button
              type="button"
              onClick={() => onUse(t.prompt, inferRunType(t.chain))}
              className="mt-2 text-xs font-semibold py-2 rounded-md bg-[#031634] text-white hover:opacity-95"
            >
              Use template
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
