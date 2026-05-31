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

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, user, logout, isAuthenticated } = useAuth();
  const [busy, setBusy] = useState(false);

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

    if (isAuthenticated && user && user.role !== role) {
      toast.error("Log out first, then enter as the other role.");
      return;
    }
    if (isAuthenticated && user && user.role === role) {
      navigate(afterLogin);
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
    <div className="bg-white selection:bg-indigo-50 selection:text-indigo-900 min-h-screen relative overflow-hidden">
      <MegaNav enterWithPera={enterWithPera} />

      <main className="pt-14">
        {/* Full-bleed background decorations spanning 100% viewport width */}
        <div className="absolute top-0 left-0 right-0 h-[700px] pointer-events-none overflow-hidden -z-10 w-full">
          {/* Subtle full-bleed SVG Grid Overlay */}
          <svg className="absolute inset-0 w-full h-full stroke-slate-200/40 [mask-image:radial-gradient(100%_100%_at_top_center,white,transparent_80%)]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse" x="50%" y="-1">
                <path d="M.5 40V.5H40" fill="none" strokeDasharray="3 3" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          </svg>

          {/* Extremely soft dynamic moving mesh blobs positioned relative to the full viewport width */}
          <div className="absolute top-[-25%] left-[-15%] w-[65vw] h-[65vw] rounded-full bg-indigo-500/[0.04] blur-[150px] animate-blob" />
          <div className="absolute bottom-[-10%] right-[-15%] w-[60vw] h-[60vw] rounded-full bg-emerald-500/[0.03] blur-[140px] animate-blob animation-delay-2000" />
          <div className="absolute top-[30%] left-[10%] w-[55vw] h-[55vw] rounded-full bg-violet-500/[0.04] blur-[130px] animate-blob animation-delay-4000" />
        </div>

        <section className="relative max-w-5xl mx-auto px-6 pt-32 pb-24 text-center">
          <div className="flex flex-col items-center gap-6 relative z-10">
            <motion.span 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="inline-block py-1.5 px-4 rounded-full bg-indigo-50/80 backdrop-blur-sm border border-indigo-200/50 text-indigo-700 text-xs font-bold tracking-[0.2em] uppercase mb-2 shadow-sm"
            >
              Build AI Products
            </motion.span>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="font-headline text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-[#031634] to-indigo-600 leading-[1.1] tracking-tight drop-shadow-sm"
            >
              Automate <br className="hidden md:block" />
              Creative Work.
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="font-body text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mt-2 leading-relaxed"
            >
              APIs, creator tools, publishing agents, and AI workflows powered by <strong className="text-slate-700 font-semibold">SentinelAI</strong>.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap justify-center gap-4 mt-8"
            >
              <button
                type="button"
                onClick={() => (isAuthenticated ? navigate("/dashboard/home") : enterWithPera("user"))}
                className="group px-8 py-4 bg-[#031634] text-white rounded-full text-[15px] font-semibold hover:bg-indigo-600 hover:shadow-xl hover:shadow-indigo-500/20 transition-all duration-300 transform hover:-translate-y-1 flex items-center gap-2"
              >
                Explore Marketplace
                <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  isAuthenticated ? navigate("/studio") : enterWithPera("user", { redirect: "/studio" })
                }
                className="group px-8 py-4 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full text-[15px] font-semibold text-slate-700 hover:bg-white hover:border-slate-300 hover:shadow-md hover:text-slate-900 transition-all duration-300 transform hover:-translate-y-1 flex items-center gap-2"
              >
                Open Studio
                <span className="material-symbols-outlined text-[18px] text-emerald-500 group-hover:rotate-12 transition-transform">auto_awesome</span>
              </button>
            </motion.div>
          </div>
        </section>

        {/* Continuous Horizontal Logo / Tech Marquee */}
        <section className="relative w-full overflow-hidden py-8 border-y border-slate-100 bg-slate-50/50 backdrop-blur-sm -mt-6 mb-16">
          <div className="max-w-5xl mx-auto px-6">
            <p className="text-center text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-4">
              Decentralized Infrastructure Supporting World-Class AI
            </p>
            <div className="relative w-full flex items-center overflow-hidden">
              {/* Left/Right blur gradients for smooth fading edges */}
              <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none" />
              
              <div className="flex animate-marquee gap-16 whitespace-nowrap">
                {/* First list of items */}
                {[
                  { name: "Algorand L1", icon: "hub" },
                  { name: "Pera Wallet", icon: "account_balance_wallet" },
                  { name: "DeepSeek V3", icon: "psychology" },
                  { name: "Llama 3.3", icon: "memory" },
                  { name: "Groq Inference", icon: "bolt" },
                  { name: "Stable Diffusion", icon: "image" },
                  { name: "Whisper Speech", icon: "graphic_eq" },
                  { name: "n8n Workflows", icon: "account_tree" },
                  { name: "LangChain Agents", icon: "mediation" }
                ].map((tech, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-slate-500 font-semibold text-[13px] tracking-wide">
                    <span className="material-symbols-outlined text-[18px] text-indigo-500">{tech.icon}</span>
                    <span>{tech.name}</span>
                  </div>
                ))}
                {/* Duplicate list of items to enable continuous scrolling */}
                {[
                  { name: "Algorand L1", icon: "hub" },
                  { name: "Pera Wallet", icon: "account_balance_wallet" },
                  { name: "DeepSeek V3", icon: "psychology" },
                  { name: "Llama 3.3", icon: "memory" },
                  { name: "Groq Inference", icon: "bolt" },
                  { name: "Stable Diffusion", icon: "image" },
                  { name: "Whisper Speech", icon: "graphic_eq" },
                  { name: "n8n Workflows", icon: "account_tree" },
                  { name: "LangChain Agents", icon: "mediation" }
                ].map((tech, idx) => (
                  <div key={`dup-${idx}`} className="flex items-center gap-2 text-slate-500 font-semibold text-[13px] tracking-wide">
                    <span className="material-symbols-outlined text-[18px] text-indigo-500">{tech.icon}</span>
                    <span>{tech.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="marketplace" className="max-w-4xl mx-auto px-6 pb-12 grid gap-6 md:grid-cols-2 scroll-mt-20">
          {/* Marketplace Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="group relative bg-white border border-slate-200 rounded-[20px] p-6 hover:border-indigo-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover-glow-card transition-all duration-500 overflow-hidden cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-indigo-100 to-transparent rounded-bl-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
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
              onClick={() => (isAuthenticated ? navigate("/dashboard/home") : enterWithPera("user"))}
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
            className="group relative bg-white border border-slate-200 rounded-[20px] p-6 hover:border-emerald-300 hover:shadow-2xl hover:shadow-emerald-500/10 hover-glow-card transition-all duration-500 overflow-hidden cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-emerald-100 to-transparent rounded-bl-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
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

        <section id="roles" className="max-w-4xl mx-auto px-6 py-8 flex flex-col items-center scroll-mt-20">
          <div className="w-full grid md:grid-cols-2 gap-6">
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              type="button"
              disabled={busy}
              onClick={() => enterWithPera("creator")}
              className="relative flex flex-col text-left bg-white border border-slate-200 p-6 rounded-[20px] hover:border-[#031634]/30 hover-glow-card transition-all duration-500 group cursor-pointer disabled:opacity-50 hover:-translate-y-1 hover:shadow-2xl overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
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

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[#031634] font-bold group-hover:text-indigo-600 transition-colors">
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
              onClick={() => enterWithPera("user")}
              className="relative flex flex-col text-left bg-white border border-slate-200 p-6 rounded-[20px] hover:border-indigo-300 hover-glow-card transition-all duration-500 group cursor-pointer disabled:opacity-50 hover:-translate-y-1 hover:shadow-2xl overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
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

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-indigo-600 font-bold group-hover:text-indigo-700 transition-colors">
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

      <footer className="bg-white border-t border-slate-100 py-16 px-8 mt-32">
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
                    href="https://github.com/DE-V8/pay-per-usage-ai-api-access-system-using-algorand"
                    className="text-slate-500 hover:text-indigo-600 transition-colors duration-300 font-medium cursor-pointer"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Legal</p>
              <ul className="space-y-3 text-sm flex flex-col items-start">
                <li>
                  <a href="#" className="text-slate-500 hover:text-indigo-600 transition-colors duration-300 font-medium cursor-pointer">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="text-slate-500 hover:text-indigo-600 transition-colors duration-300 font-medium cursor-pointer">
                    Privacy Policy
                  </a>
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
    </div>
  );
}
