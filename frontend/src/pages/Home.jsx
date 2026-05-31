import React from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { useEffect, useState } from "react";
import ContractStats from "../components/ContractStats.jsx";
import { connectPera } from "../wallet/pera.js";
import { api } from "../api/client.js";
import HowItWorks from "../components/HowItWorks.jsx";
import MegaNav from "../components/MegaNav.jsx";
import InteractiveBackground from "../components/InteractiveBackground.jsx";
import LiveTxFeed from "../components/LiveTxFeed.jsx";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, user, logout, isAuthenticated } = useAuth();
  const [busy, setBusy] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [activeLegalTab, setActiveLegalTab] = useState("risk");

  const [showReg, setShowReg] = useState(false);
  const [regRole, setRegRole] = useState("user");
  const [regName, setRegName] = useState("");
  const [regWallet, setRegWallet] = useState("");
  const [nameAvailable, setNameAvailable] = useState(null);
  const [nameError, setNameError] = useState("");
  const [checkingName, setCheckingName] = useState(false);
  const [regRedirect, setRegRedirect] = useState("/dashboard/home");



  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace(/^#/, "");
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => clearTimeout(t);
  }, [location.hash]);

  useEffect(() => {
    if (!regName || regName.trim().length < 3) {
      setNameAvailable(null);
      setNameError("");
      return;
    }
    const clean = regName.trim();
    if (!/^[a-zA-Z0-9_\s-]+$/.test(clean)) {
      setNameAvailable(false);
      setNameError("Only alphanumeric, space, hyphens or underscores allowed.");
      return;
    }
    setCheckingName(true);
    const delay = setTimeout(async () => {
      try {
        const { data } = await api.get(`/api/auth/check-name?name=${encodeURIComponent(clean)}`);
        setNameAvailable(data.available);
        setNameError(data.available ? "" : "This display name is already taken.");
      } catch {
        setNameAvailable(null);
      } finally {
        setCheckingName(false);
      }
    }, 450);

    return () => clearTimeout(delay);
  }, [regName]);

  async function handleFinalizeRegistration(e) {
    e.preventDefault();
    if (!regName || regName.trim().length < 3) {
      return toast.error("Choose a valid name (at least 3 characters)");
    }
    if (nameAvailable === false) {
      return toast.error("Please choose a unique display name");
    }
    if (!regWallet) {
      return toast.error("Wallet address missing");
    }
    setBusy(true);
    try {
      await register(regWallet, regRole, regName.trim());
      toast.success("Profile set up! Welcome to Sentinel.");
      setShowReg(false);
      navigate(regRole === "creator" ? "/creator" : regRedirect || "/dashboard/home");
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  async function enterWithPera(role, options = {}) {
    const afterLogin =
      options.redirect || (role === "creator" ? "/creator" : "/dashboard/home");

    if (isAuthenticated && user) {
      const currentRole = user.role;
      const hasCapability = currentRole === role || (role === "user" && currentRole === "creator");
      if (hasCapability) {
        navigate(afterLogin);
        return;
      }
      toast.error("Log out first, then enter as the other role.");
      return;
    }

    setBusy(true);
    try {
      toast.loading("Connecting Pera Wallet...", { id: "pera-login" });
      const addr = await connectPera();
      toast.loading("Signing in...", { id: "pera-login" });

      const res = await login(addr, role);

      if (res.needsProfile || res.isNewUser) {
        setRegWallet(addr);
        setRegRole(role);
        setRegRedirect(afterLogin);
        setRegName("");
        setShowReg(true);
        toast.success("Wallet connected! Choose a display name to finish setup.", {
          id: "pera-login",
          duration: 5000,
        });
      } else {
        toast.success(`Welcome back${res.user.displayName ? `, ${res.user.displayName}` : ""}!`, {
          id: "pera-login",
        });
        navigate(afterLogin);
      }
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.error || e?.message || "Pera Wallet login failed", {
        id: "pera-login",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[#fafafc] selection:bg-indigo-50 selection:text-indigo-900 min-h-screen relative overflow-hidden">
      <MegaNav enterWithPera={enterWithPera} />

      <main className="pt-14">
        {/* Full-page ambient mesh background overlay */}
        <div className="absolute inset-0 pointer-events-none z-0">
          {/* Subtle full-bleed SVG Grid Overlay */}
          <svg className="absolute inset-0 w-full h-full stroke-slate-200/30 [mask-image:linear-gradient(to_bottom,white_20%,transparent_90%)]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid-pattern-full" width="40" height="40" patternUnits="userSpaceOnUse" x="50%" y="-1">
                <path d="M.5 40V.5H40" fill="none" strokeDasharray="3 3" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern-full)" />
          </svg>

          {/* Extremely soft dynamic moving mesh blobs positioned at different scroll levels */}
          {/* Top section (Hero) */}
          <div className="absolute top-[-5%] left-[-10%] w-[50vw] h-[50vw] min-w-[400px] min-h-[400px] rounded-full bg-indigo-300/[0.12] blur-[130px] animate-blob" />
          <div className="absolute top-[10%] right-[-10%] w-[45vw] h-[45vw] min-w-[350px] min-h-[350px] rounded-full bg-emerald-200/[0.08] blur-[120px] animate-blob animation-delay-2000" />
          <div className="absolute top-[25%] left-[5%] w-[40vw] h-[40vw] min-w-[300px] min-h-[300px] rounded-full bg-violet-300/[0.1] blur-[110px] animate-blob animation-delay-4000" />

          {/* Middle section (Marketplace & Studio) */}
          <div className="absolute top-[45%] right-[-5%] w-[45vw] h-[45vw] min-w-[350px] min-h-[350px] rounded-full bg-indigo-200/[0.08] blur-[140px] animate-blob animation-delay-2000" />
          <div className="absolute top-[55%] left-[-5%] w-[45vw] h-[45vw] min-w-[350px] min-h-[350px] rounded-full bg-emerald-200/[0.07] blur-[130px] animate-blob" />

          {/* Bottom section (How It Works & Stats) */}
          <div className="absolute top-[75%] right-[10%] w-[50vw] h-[50vw] min-w-[400px] min-h-[400px] rounded-full bg-violet-200/[0.09] blur-[150px] animate-blob animation-delay-4000" />
          <div className="absolute bottom-[5%] left-[5%] w-[40vw] h-[40vw] min-w-[350px] min-h-[350px] rounded-full bg-indigo-300/[0.07] blur-[120px] animate-blob" />
        </div>

        {/* Constrain Interactive Background Canvas to the Hero/Top fold */}
        <div className="absolute top-0 left-0 right-0 h-[780px] pointer-events-none overflow-hidden z-0 w-full">
          <InteractiveBackground />
        </div>

        <section className="relative max-w-6xl mx-auto px-6 pt-8 pb-16">
          <div className="grid md:grid-cols-2 gap-12 items-start relative z-10">

            {/* LEFT: Headline & CTAs */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-8"
            >
              <motion.div
                variants={itemVariants}
                className="inline-flex items-center gap-3 w-fit"
              >
                <span className="inline-flex items-center gap-1.5 py-1.5 px-4 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200/80 shadow-sm text-[10px] font-bold tracking-[0.15em] uppercase text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  <span className="text-indigo-600">Marketplace</span>
                  <span className="text-slate-300">·</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-emerald-600">AI Studio</span>
                  <span className="text-slate-300">·</span>
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-emerald-600">Live on Algorand</span>
                </span>
              </motion.div>

              <motion.h1
                variants={itemVariants}
                className="font-headline text-[3rem] md:text-[3.75rem] font-extrabold leading-[1.08] tracking-tight text-slate-900"
              >
                APIs, AI Studio &
                <br />
                <span className="bg-gradient-to-r from-indigo-600 via-violet-500 to-emerald-500 bg-clip-text text-transparent">
                  pay per API call.
                </span>
              </motion.h1>

              <motion.p
                variants={itemVariants}
                className="font-body text-[15px] text-slate-500 max-w-[420px] leading-relaxed"
              >
                A <strong className="text-slate-700">decentralized API marketplace</strong> for developers and an{" "}
                <strong className="text-slate-700">AI creative Studio</strong> for creators — both settled per-request on Algorand. No monthly plans, no lock-in.
              </motion.p>

              {/* 3 value pillars — lightweight inline row */}
              <motion.div
                variants={itemVariants}
                className="flex items-center gap-6"
              >
                {[
                  { icon: "toll",      label: "Pay Per Call",    iconColor: "text-indigo-500" },
                  { icon: "lock_open", label: "No Subscription", iconColor: "text-violet-500" },
                  { icon: "verified",  label: "On-Chain Proof",  iconColor: "text-emerald-500" },
                ].map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className={`material-symbols-outlined ${p.iconColor} text-[17px]`}>{p.icon}</span>
                    <span className="text-[11.5px] font-semibold text-slate-600">{p.label}</span>
                  </div>
                ))}
              </motion.div>

              <motion.div
                variants={itemVariants}
                className="flex flex-wrap gap-3"
              >
                <button
                  type="button"
                  onClick={() => (isAuthenticated ? navigate("/dashboard/browse") : enterWithPera("user", { redirect: "/dashboard/browse" }))}
                  className="group px-6 py-3 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-full text-[13px] font-semibold hover:from-indigo-600 hover:to-violet-600 hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-300 hover:-translate-y-px flex items-center gap-2 shadow-md shadow-slate-900/20"
                >
                  Browse Marketplace
                  <span className="material-symbols-outlined text-[15px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
                <button
                  type="button"
                  onClick={() => isAuthenticated ? navigate("/studio") : enterWithPera("user", { redirect: "/studio" })}
                  className="group px-6 py-3 bg-white border border-slate-200 rounded-full text-[13px] font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 hover:shadow-md transition-all duration-300 hover:-translate-y-px flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[15px] text-emerald-500">auto_awesome</span>
                  Open AI Studio
                </button>
              </motion.div>
            </motion.div>

            {/* RIGHT: Live On-Chain Transaction Feed */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="hidden md:block"
            >
              <LiveTxFeed />
            </motion.div>

          </div>
        </section>

        {/* Continuous Horizontal Logo / Tech Marquee */}
        <section className="relative w-full overflow-hidden py-6 border-y border-slate-200/50 bg-white/40 backdrop-blur-md mb-16 z-10">
          <div className="relative w-full flex items-center overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#fafafc] to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#fafafc] to-transparent z-10 pointer-events-none" />
            <div className="flex animate-marquee gap-14 whitespace-nowrap">
              {[
                { name: "Algorand L1", icon: "hub", color: "text-indigo-500" },
                { name: "0.001 ALGO / tx", icon: "toll", color: "text-emerald-500" },
                { name: "Pera Wallet", icon: "account_balance_wallet", color: "text-violet-500" },
                { name: "DeepSeek V3", icon: "psychology", color: "text-indigo-500" },
                { name: "Groq Inference", icon: "bolt", color: "text-amber-500" },
                { name: "x402 Protocol", icon: "lock", color: "text-rose-500" },
                { name: "Stable Diffusion", icon: "image", color: "text-cyan-500" },
                { name: "n8n Workflows", icon: "account_tree", color: "text-emerald-500" },
                { name: "No Subscription", icon: "block", color: "text-slate-400" },
                { name: "On-Chain Proof", icon: "verified", color: "text-indigo-500" },
              ].flatMap((tech, idx) => [
                <div key={idx} className="flex items-center gap-2 text-slate-500 font-semibold text-[12px] tracking-wide">
                  <span className={`material-symbols-outlined text-[16px] ${tech.color}`}>{tech.icon}</span>
                  <span>{tech.name}</span>
                </div>,
                <div key={`sep-${idx}`} className="w-1 h-1 rounded-full bg-slate-300/60" />
              ])}
              {[
                { name: "Algorand L1", icon: "hub", color: "text-indigo-500" },
                { name: "0.001 ALGO / tx", icon: "toll", color: "text-emerald-500" },
                { name: "Pera Wallet", icon: "account_balance_wallet", color: "text-violet-500" },
                { name: "DeepSeek V3", icon: "psychology", color: "text-indigo-500" },
                { name: "Groq Inference", icon: "bolt", color: "text-amber-500" },
                { name: "x402 Protocol", icon: "lock", color: "text-rose-500" },
                { name: "Stable Diffusion", icon: "image", color: "text-cyan-500" },
                { name: "n8n Workflows", icon: "account_tree", color: "text-emerald-500" },
                { name: "No Subscription", icon: "block", color: "text-slate-400" },
                { name: "On-Chain Proof", icon: "verified", color: "text-indigo-500" },
              ].flatMap((tech, idx) => [
                <div key={`dup-${idx}`} className="flex items-center gap-2 text-slate-500 font-semibold text-[12px] tracking-wide">
                  <span className={`material-symbols-outlined text-[16px] ${tech.color}`}>{tech.icon}</span>
                  <span>{tech.name}</span>
                </div>,
                <div key={`sep2-${idx}`} className="w-1 h-1 rounded-full bg-slate-300/60" />
              ])}
            </div>
          </div>
        </section>




        <section id="marketplace" className="max-w-4xl mx-auto px-6 pb-12 grid gap-6 md:grid-cols-2 scroll-mt-20 relative z-10">
          {/* Marketplace Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="group relative bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-[20px] p-6 hover:border-indigo-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover-glow-card transition-all duration-500 overflow-hidden cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-indigo-100/30 to-transparent rounded-bl-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-sm">
              <span className="material-symbols-outlined text-indigo-600 text-xl">api</span>
            </div>
            <p className="text-[10px] font-bold tracking-[0.15em] text-indigo-600 uppercase mb-2">For Developers</p>
            <h3 className="font-headline text-2xl font-bold text-slate-900">Marketplace</h3>
            <p className="text-sm text-slate-500 mt-3 leading-relaxed">
              Publish APIs, monetize inference, and run x402 payments on Algorand-native infrastructure.
            </p>
            <button
              type="button"
              onClick={() => (isAuthenticated ? navigate("/dashboard/browse") : enterWithPera("user", { redirect: "/dashboard/browse" }))}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 group-hover:text-indigo-700 transition-colors"
            >
              Browse APIs <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
          </motion.div>
          
          {/* Studio Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="group relative bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-[20px] p-6 hover:border-emerald-300 hover:shadow-2xl hover:shadow-emerald-500/10 hover-glow-card transition-all duration-500 overflow-hidden cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-emerald-100/30 to-transparent rounded-bl-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-sm">
              <span className="material-symbols-outlined text-emerald-600 text-xl">edit_square</span>
            </div>
            <p className="text-[10px] font-bold tracking-[0.15em] text-emerald-600 uppercase mb-2">For Creators</p>
            <h3 className="font-headline text-2xl font-bold text-slate-900">Studio</h3>
            <p className="text-sm text-slate-500 mt-3 leading-relaxed">
              Use AI Video Editor, Blog Writer, and Data Analyst workflows in one centralized workspace.
            </p>
            <button
              type="button"
              onClick={() =>
                isAuthenticated ? navigate("/studio") : enterWithPera("user", { redirect: "/studio" })
              }
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 group-hover:text-emerald-700 transition-colors"
            >
              Open Studio <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
          </motion.div>
        </section>

        <section id="roles" className="max-w-4xl mx-auto px-6 py-8 flex flex-col items-center scroll-mt-20 relative z-10">
          <div className="w-full grid md:grid-cols-2 gap-6">
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              type="button"
              disabled={busy}
              onClick={() => enterWithPera("creator")}
              className="relative flex flex-col text-left bg-white/70 backdrop-blur-md border border-slate-200/80 p-6 rounded-[20px] hover:border-[#031634]/30 hover-glow-card transition-all duration-500 group cursor-pointer disabled:opacity-50 hover:-translate-y-1 hover:shadow-2xl overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="flex flex-col gap-4 z-10 relative h-full">
                <div className="flex justify-between items-start">
                  <span className="font-body text-[10px] font-bold tracking-[0.15em] text-[#031634] bg-slate-100 border border-slate-200 px-3 py-1 rounded-full uppercase shadow-sm">
                    CREATOR ROLE
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-200 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-sm">
                    <span className="material-symbols-outlined text-[#031634] text-xl">terminal</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-grow mt-1">
                  <h3 className="font-headline text-2xl font-bold text-slate-900 group-hover:text-[#031634] transition-colors">Deploy &amp; Earn</h3>
                  <p className="font-body text-sm leading-relaxed text-slate-500">
                    Publish AI endpoints securely. Set your own token pricing, and track live Algorand earnings.
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100/50 flex items-center justify-between text-[#031634] font-bold group-hover:text-indigo-600 transition-colors">
                  <span className="text-xs font-semibold tracking-wide uppercase">Connect Pera Wallet</span>
                  <span className="material-symbols-outlined text-lg group-hover:translate-x-2 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
              type="button"
              disabled={busy}
              onClick={() => (isAuthenticated ? navigate("/dashboard/browse") : enterWithPera("user", { redirect: "/dashboard/browse" }))}
              className="relative flex flex-col text-left bg-white/70 backdrop-blur-md border border-slate-200/80 p-6 rounded-[20px] hover:border-indigo-300 hover-glow-card transition-all duration-500 group cursor-pointer disabled:opacity-50 hover:-translate-y-1 hover:shadow-2xl overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="flex flex-col gap-4 z-10 relative h-full">
                <div className="flex justify-between items-start">
                  <span className="font-body text-[10px] font-bold tracking-[0.15em] text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full uppercase shadow-sm">
                    USER ROLE
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 shadow-sm">
                    <span className="material-symbols-outlined text-indigo-600 text-xl">storefront</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-grow mt-1">
                  <h3 className="font-headline text-2xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Access &amp; Pay</h3>
                  <p className="font-body text-sm leading-relaxed text-slate-500">
                    Browse the decentralized marketplace of AI APIs. Pay per request using Pera Wallet instantly.
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100/50 flex items-center justify-between text-indigo-600 font-bold group-hover:text-indigo-700 transition-colors">
                  <span className="text-xs font-semibold tracking-wide uppercase">Connect Pera Wallet</span>
                  <span className="material-symbols-outlined text-lg group-hover:translate-x-2 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </div>
            </motion.button>
          </div>
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-8 font-body text-sm text-slate-400 bg-slate-50 px-6 py-2 rounded-full border border-slate-100 mb-12"
          >
            Sign in with your <span className="font-semibold text-slate-500">Algorand Pera Wallet</span>. No Google account required.
          </motion.p>
        </section>

        <HowItWorks enterWithPera={enterWithPera} />

        <ContractStats />
      </main>

      <footer className="bg-white/60 border-t border-slate-200/60 backdrop-blur-md py-16 px-8 mt-32 relative z-10">
        <div className="max-w-screen-2xl mx-auto">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="text-xl font-bold tracking-tight font-headline text-slate-900">Sentinel</span>
              <p className="text-sm text-slate-400 mt-3 leading-relaxed max-w-xs">
                Pay-per-use AI APIs on Algorand. No subscriptions, no lock-in.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Platform</p>
              <ul className="space-y-3 text-sm flex flex-col items-start">
                <li>
                  <button
                    type="button"
                    onClick={() => (isAuthenticated ? navigate("/dashboard/browse") : enterWithPera("user", { redirect: "/dashboard/browse" }))}
                    className="text-slate-500 hover:text-indigo-600 transition-colors duration-300 font-medium text-left cursor-pointer"
                  >
                    Marketplace
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => (isAuthenticated ? navigate("/studio") : enterWithPera("user", { redirect: "/studio" }))}
                    className="text-slate-500 hover:text-indigo-600 transition-colors duration-300 font-medium text-left cursor-pointer"
                  >
                    Studio
                  </button>
                </li>
                <li>
                  <Link to="/docs/x402" className="text-slate-500 hover:text-indigo-600 transition-colors duration-300 font-medium cursor-pointer">
                    x402 Docs
                  </Link>
                </li>
                <li>
                  <Link to="/sdk-demo" className="text-slate-500 hover:text-indigo-600 transition-colors duration-300 font-medium cursor-pointer">
                    Developer SDK
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Resources</p>
              <ul className="space-y-3 text-sm flex flex-col items-start">
                <li>
                  <Link to="/docs/how-it-works" className="text-slate-500 hover:text-indigo-600 transition-colors duration-300 font-medium cursor-pointer">
                    How It Works
                  </Link>
                </li>
                <li>
                  <a
                    href="https://github.com/lathi-aayush/pay-per-usage-ai-api-access-system-using-algorand/tree/main"
                    className="text-slate-500 hover:text-indigo-600 transition-colors duration-300 font-medium cursor-pointer"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:wesentinal@gmail.com"
                    className="text-slate-500 hover:text-indigo-600 transition-colors duration-300 font-medium cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[15px] text-indigo-500">mail</span>
                    Contact Us
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.instagram.com/sentinal_apimarketplace?igsh=ejNrdW95ZWEwNWYz"
                    className="text-slate-500 hover:text-indigo-600 transition-colors duration-300 font-medium cursor-pointer flex items-center gap-1.5"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="material-symbols-outlined text-[15px] text-pink-500">photo_camera</span>
                    Instagram
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Legal</p>
              <ul className="space-y-3 text-sm flex flex-col items-start">
                <li>
                  <button
                    onClick={() => {
                      setActiveLegalTab("tos");
                      setShowDisclaimer(true);
                    }}
                    className="text-slate-500 hover:text-indigo-600 transition-colors duration-300 font-medium cursor-pointer text-left focus:outline-none"
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setActiveLegalTab("privacy");
                      setShowDisclaimer(true);
                    }}
                    className="text-slate-500 hover:text-indigo-600 transition-colors duration-300 font-medium cursor-pointer text-left focus:outline-none"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setActiveLegalTab("risk");
                      setShowDisclaimer(true);
                    }}
                    className="text-slate-500 hover:text-indigo-600 transition-colors duration-300 font-medium cursor-pointer text-left focus:outline-none"
                  >
                    Risk Disclosure
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold tracking-wider font-body uppercase mt-12 pt-8 border-t border-slate-100">
            © 2026 Sentinel Infrastructure
          </p>
        </div>
      </footer>

      {showReg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white dark:bg-[#1A1C1C] border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl max-w-md w-full p-8 relative flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 font-bold tracking-wider text-[10px] rounded-full w-max uppercase">
                One-Time Profile Setup
              </span>
              <h2 className="text-2xl font-bold font-headline text-slate-900 dark:text-white">
                Welcome to Sentinel
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Your Pera wallet is connected. Choose a unique display name to finish setup.
              </p>
            </div>

            <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl px-4 py-3">
              <span className="material-symbols-outlined text-emerald-500 text-lg">account_balance_wallet</span>
              <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400 font-bold truncate">
                {regWallet}
              </span>
            </div>

            <form onSubmit={handleFinalizeRegistration} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Unique Display Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={30}
                    placeholder="e.g. Alice_Sentinel"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 font-medium focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                    {checkingName ? (
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-primary rounded-full animate-spin"></div>
                    ) : regName.trim().length >= 3 ? (
                      nameAvailable ? (
                        <span className="material-symbols-outlined text-emerald-500 font-bold text-lg" title="Name is available!">
                          check_circle
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-rose-500 font-bold text-lg" title={nameError || "Name is taken"}>
                          cancel
                        </span>
                      )
                    ) : null}
                  </div>
                </div>
                {nameError && (
                  <span className="text-[10px] text-rose-500 font-medium mt-0.5">{nameError}</span>
                )}
                {nameAvailable && !nameError && regName.trim().length >= 3 && (
                  <span className="text-[10px] text-emerald-500 font-medium mt-0.5">Username available!</span>
                )}
              </div>

              <div className="flex gap-3.5 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReg(false);
                    logout();
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || nameAvailable !== true}
                  className="flex-1 bg-[#031634] hover:bg-[#031634]/90 dark:bg-white dark:text-[#031634] text-white py-3 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? "Saving..." : "Finish Setup"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDisclaimer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white dark:bg-[#1A1C1C] border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl max-w-lg w-full p-8 relative flex flex-col gap-6">
            
            {/* Header */}
            <div className="flex flex-col gap-2">
              <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-bold tracking-wider text-[10px] rounded-full w-max uppercase">
                Legal & Safety
              </span>
              <h2 className="text-2xl font-bold font-headline text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500">gavel</span>
                Legal Center
              </h2>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setActiveLegalTab("tos")}
                className={`flex-1 pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  activeLegalTab === "tos"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                Terms of Service
              </button>
              <button
                onClick={() => setActiveLegalTab("privacy")}
                className={`flex-1 pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  activeLegalTab === "privacy"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                Privacy Policy
              </button>
              <button
                onClick={() => setActiveLegalTab("risk")}
                className={`flex-1 pb-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  activeLegalTab === "risk"
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                Risk Disclosure
              </button>
            </div>

            {/* Content Area */}
            <div className="max-h-[300px] overflow-y-auto pr-2 flex flex-col gap-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed py-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
              {activeLegalTab === "tos" && (
                <div className="flex flex-col gap-4">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-1">1. Acceptance of Terms</h4>
                    <p>
                      By connecting your wallet to Sentinel, you agree to comply with these terms. The platform serves as a peer-to-peer developer marketplace mapping AI APIs to Algorand smart contracts.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-1">2. Developer & Creator Responsibilities</h4>
                    <p>
                      Creators who list AI models must ensure they have legitimate access to upstream AI service keys. Listing malicious, illegal, or copyright-violating endpoints is strictly prohibited and will lead to listing suspension.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-1">3. Protocol Fees</h4>
                    <p>
                      Transactions may involve smart contract executing fees and standard network gas charges paid directly to the Algorand blockchain. Sentinel does not custody or hold user funds.
                    </p>
                  </div>
                </div>
              )}

              {activeLegalTab === "privacy" && (
                <div className="flex flex-col gap-4">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-1">1. Decentralized & Self-Custodial</h4>
                    <p>
                      Sentinel does not collect or store personal data, passwords, or emails. All authorization relies on cryptographic signatures from your Algorand wallet.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-1">2. Local Storage</h4>
                    <p>
                      Burner wallet details and cryptographic seed phrases are stored locally on your device's browser cache. This data is never sent to our servers.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-1">3. On-Chain Transparency</h4>
                    <p>
                      All pay-per-usage API call counts and wallet interaction metrics are logged publicly and permanently on the Algorand blockchain.
                    </p>
                  </div>
                </div>
              )}

              {activeLegalTab === "risk" && (
                <div className="flex flex-col gap-4">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-1">1. On-Chain Settlements & Non-Refundability</h4>
                    <p>
                      All pay-per-usage transactions are processed and settled directly on the Algorand blockchain. Once a transaction is broadcasted, it is irreversible. Sentinel cannot refund ALGO or custom tokens spent on API keys or requests.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-1">2. Local Storage & Burner Wallets</h4>
                    <p>
                      If you generate or use a temporary burner wallet, the private seed phrase is saved solely in your local browser storage. Clearing browser data, caching, or using private browsing will erase this wallet. You must back up your seed phrase; lost keys cannot be recovered by the platform.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-1">3. Upstream AI API Dependencies</h4>
                    <p>
                      Sentinel serves as a decentralized gateway proxy to external AI models (e.g. OpenAI, Anthropic, Groq). We do not control or guarantee the uptime, speed, correctness, safety, or content filters of upstream AI providers.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white mb-1">4. Smart Contract Execution & Logging</h4>
                    <p>
                      By using this platform, you interact with Algorand Smart Contracts. Transaction details, including masked wallet addresses, transaction IDs, and call logs, are publicly recorded on the blockchain forever.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowDisclaimer(false)}
                className="px-6 py-3 bg-[#031634] hover:bg-[#031634]/90 dark:bg-white dark:text-[#031634] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
