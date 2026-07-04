import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import GuestConnectBanner from "../../components/GuestConnectBanner.jsx";
import {
  ethDisplayToInr,
  ethDisplayToUsd,
} from "../../constants/studioPlans.js";

const RATES = [
  {
    id: "prompt_single",
    name: "Prompt Generator",
    desc: "Generate, analyze, and refine prompts with Gemini models.",
    price: 0.5,
    icon: "auto_awesome",
  },
  {
    id: "blog_draft",
    name: "Blogging Agent",
    desc: "Write fully optimized long-form SEO articles with Groq/Llama.",
    price: 1.0,
    icon: "article",
  },
  {
    id: "workflow_creative",
    name: "Creative Workflow",
    desc: "Automated chain combining prompt generator and image renderer.",
    price: 2.5,
    icon: "linked_services",
  },
  {
    id: "clipcraft_pack",
    name: "ClipCraft Pack",
    desc: "Generate vertical loops and cinematically compiled short video clips.",
    price: 2.5,
    icon: "movie_edit",
  },
  {
    id: "agentic_text",
    name: "Agentic Text Node",
    desc: "Run basic agent text generations and reasoning nodes.",
    price: 0.5,
    icon: "notes",
  },
  {
    id: "agentic_images",
    name: "Agentic Image Workflow",
    desc: "Generate keyframes and multi-stage image assets.",
    price: 5.0,
    icon: "image",
  },
  {
    id: "agentic_full",
    name: "Agentic Video/Audio Run",
    desc: "Cinematic text-to-video (Veo) plus narration voiceover.",
    price: 15.0,
    icon: "video_file",
  },
];

export default function StudioPlan() {
  const { user, isAuthenticated } = useAuth();

  const { data: usage } = useQuery({
    queryKey: ["studio-usage"],
    queryFn: async () => (await api.get("/api/studio/usage")).data,
    enabled: Boolean(user),
  });

  return (
    <div className="pt-6 w-full max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="font-headline text-2xl font-semibold text-primary">Billing &amp; Rates</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Sentinel AI Studio operates on a transparent, pay-per-call model. No monthly subscriptions, no recurring commitments. 
          All features (cinematic Veo video generation, text-to-speech, infinite projects, and platform publishing) are fully unlocked.
        </p>
        <p className="text-xs text-slate-500 mt-2 font-semibold text-[#031634]">
          Status: Pay-per-Call Mode Active · Micropayments Enabled
        </p>
        {!isAuthenticated && (
          <GuestConnectBanner message="Connect MetaMask to view usage details." className="mt-4" />
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {RATES.map((rate) => {
          return (
            <motion.div
              key={rate.id}
              whileHover={{ y: -4 }}
              className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="material-symbols-outlined text-[#031634] text-xl bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {rate.icon}
                  </span>
                  <h2 className="font-semibold text-primary text-base">{rate.name}</h2>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed min-h-[40px]">
                  {rate.desc}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-2xl font-bold font-mono text-[#031634]">{rate.price} ETH</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  ≈ ₹{ethDisplayToInr(rate.price)} · ≈ ${ethDisplayToUsd(rate.price)} per execution
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-6 mb-8 shadow-sm">
        <h2 className="font-semibold text-primary text-sm mb-3">How pay-per-call works</h2>
        <div className="grid md:grid-cols-3 gap-6 text-sm text-on-surface-variant">
          <div className="space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-[#031634] flex items-center justify-center font-bold">1</div>
            <p className="font-semibold text-slate-900 text-xs">Link Wallet</p>
            <p className="text-xs text-slate-500">Ensure your MetaMask is linked under your Profile menu.</p>
          </div>
          <div className="space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-[#031634] flex items-center justify-center font-bold">2</div>
            <p className="font-semibold text-slate-900 text-xs">Trigger Run</p>
            <p className="text-xs text-slate-500">When you trigger a run, a payment consent popup displays the exact ETH cost.</p>
          </div>
          <div className="space-y-1.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 text-[#031634] flex items-center justify-center font-bold">3</div>
            <p className="font-semibold text-slate-900 text-xs">Confirm On-chain</p>
            <p className="text-xs text-slate-500">Sign the transaction in MetaMask. Once verified on-chain, execution proceeds immediately.</p>
          </div>
        </div>
      </section>

      <div className="text-center">
        <Link
          to="/studio"
          className="inline-block px-6 py-2.5 rounded-full bg-[#031634] hover:bg-[#0a2855] text-white text-sm font-semibold transition-all duration-200"
        >
          Back to Studio Home
        </Link>
      </div>
    </div>
  );
}
