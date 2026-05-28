import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
      toast.success("Profile set up! Welcome to Sentinal.");
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
    <div className="bg-surface selection:bg-secondary-container selection:text-on-secondary-container min-h-screen">
      <MegaNav enterWithPera={enterWithPera} />

      <main className="pt-14">
        <HowItWorks enterWithPera={enterWithPera} />

        <section className="max-w-[1100px] mx-auto px-8 pt-16 pb-16">
          <div className="flex flex-col gap-6">
            <span className="font-body text-[11px] font-bold tracking-[0.1em] text-secondary uppercase">
              BUILD AI PRODUCTS
            </span>
            <h1 className="font-headline text-[52px] font-semibold text-primary leading-[1.15] tracking-tight">
              Automate <br />
              <span className="ml-[40px]">Creative Work.</span>
            </h1>
            <p className="font-body text-[18px] text-on-surface-variant max-w-lg mt-2">
              APIs, creator tools, publishing agents, and AI workflows powered by SentinelAI.
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                type="button"
                onClick={() => (isAuthenticated ? navigate("/dashboard/home") : enterWithPera("user"))}
                className="px-5 py-2.5 bg-[#031634] text-white rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Explore Marketplace
              </button>
              <button
                type="button"
                onClick={() =>
                  isAuthenticated ? navigate("/studio") : enterWithPera("user", { redirect: "/studio" })
                }
                className="px-5 py-2.5 border border-slate-300 rounded-md text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Open Studio
              </button>
            </div>
          </div>
        </section>



        <section id="marketplace" className="max-w-[1100px] mx-auto px-8 pb-4 grid gap-4 md:grid-cols-2 scroll-mt-20">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <p className="text-[10px] font-bold tracking-[0.15em] text-[#031634] uppercase">For Developers</p>
            <h3 className="font-headline text-2xl font-semibold text-slate-900 mt-2">Marketplace</h3>
            <p className="text-sm text-slate-600 mt-2">
              Publish APIs, monetize inference, and run x402 payments on Algorand-native infrastructure.
            </p>
            <button
              type="button"
              onClick={() => (isAuthenticated ? navigate("/dashboard/home") : enterWithPera("user"))}
              className="mt-4 text-sm font-semibold text-[#031634] underline"
            >
              Browse APIs
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <p className="text-[10px] font-bold tracking-[0.15em] text-indigo-600 uppercase">For Creators</p>
            <h3 className="font-headline text-2xl font-semibold text-slate-900 mt-2">Studio</h3>
            <p className="text-sm text-slate-600 mt-2">
              Use AI Video Editor, Blog Writer, and Data Analyst workflows in one centralized workspace.
            </p>
            <button
              type="button"
              onClick={() =>
                isAuthenticated ? navigate("/studio") : enterWithPera("user", { redirect: "/studio" })
              }
              className="mt-4 text-sm font-semibold text-indigo-600 underline"
            >
              Open Studio
            </button>
          </div>
        </section>

        <section id="studio" className="max-w-screen-2xl mx-auto px-8 py-12 flex flex-col items-center scroll-mt-20">
          <div className="flex flex-col md:flex-row gap-6 w-full max-w-[680px]">
            <button
              type="button"
              disabled={busy}
              onClick={() => enterWithPera("creator")}
              className="relative flex-1 text-left bg-white dark:bg-[#1A1C1C] border border-slate-200 dark:border-slate-800 p-8 rounded-[24px] hover:border-[#031634]/30 dark:hover:border-emerald-500/50 transition-all duration-300 group cursor-pointer disabled:opacity-50 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-emerald-900/20 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#031634]/5 to-transparent dark:from-emerald-500/10 rounded-bl-[100px] -z-10 transition-opacity group-hover:opacity-100 opacity-50"></div>

              <div className="flex flex-col gap-8 z-10 relative">
                <div className="flex justify-between items-start">
                  <span className="font-body text-[10px] font-bold tracking-[0.15em] text-[#031634] dark:text-emerald-400 bg-slate-100 dark:bg-emerald-950/30 px-3 py-1 rounded-full uppercase">
                    CREATOR
                  </span>
                  <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center border border-slate-100 dark:border-slate-800 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <span className="material-symbols-outlined text-[#031634] dark:text-white">terminal</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <h3 className="font-headline text-2xl font-bold text-slate-900 dark:text-white group-hover:text-[#031634] dark:group-hover:text-emerald-400 transition-colors">Deploy &amp; Earn</h3>
                  <p className="font-body text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                    Publish AI endpoints securely. Set your own token pricing, and track live Algorand earnings.
                  </p>
                </div>

                <div className="mt-2 flex items-center gap-2 text-[#031634] dark:text-white font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  <span className="text-sm font-semibold font-body tracking-wide">Connect Pera Wallet</span>
                  <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </div>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => enterWithPera("user")}
              className="relative flex-1 text-left bg-white dark:bg-[#1A1C1C] border border-slate-200 dark:border-slate-800 p-8 rounded-[24px] hover:border-indigo-500/30 dark:hover:border-indigo-400/50 transition-all duration-300 group cursor-pointer disabled:opacity-50 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-indigo-900/20 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-500/5 to-transparent dark:from-indigo-500/10 rounded-bl-[100px] -z-10 transition-opacity group-hover:opacity-100 opacity-50"></div>

              <div className="flex flex-col gap-8 z-10 relative">
                <div className="flex justify-between items-start">
                  <span className="font-body text-[10px] font-bold tracking-[0.15em] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1 rounded-full uppercase">
                    USER
                  </span>
                  <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center border border-slate-100 dark:border-slate-800 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                    <span className="material-symbols-outlined text-indigo-600 dark:text-white">storefront</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <h3 className="font-headline text-2xl font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Access &amp; Pay</h3>
                  <p className="font-body text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                    Browse the decentralized marketplace of AI APIs. Pay per request using Pera Wallet instantly.
                  </p>
                </div>

                <div className="mt-2 flex items-center gap-2 text-indigo-600 dark:text-white font-bold group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                  <span className="text-sm font-semibold font-body tracking-wide">Connect Pera Wallet</span>
                  <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </div>
            </button>
          </div>
          <p className="mt-8 font-body text-[12px] text-on-surface-variant/70 italic">
            Sign in with your Algorand Pera Wallet. No Google account required.
          </p>
        </section>

        <ContractStats />
      </main>

      <footer className="bg-surface border-t border-surface-variant py-12 px-8 mt-24">
        <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="flex flex-col gap-2">
            <span className="text-lg font-semibold text-primary tracking-tighter font-headline">Sentinal</span>
            <p className="text-[11px] text-on-surface-variant font-medium tracking-wide font-body uppercase">
              © 2026 SENTINAL INFRASTRUCTURE
            </p>
          </div>
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
                Welcome to Sentinal
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
                    placeholder="e.g. Alice_Sentinal"
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
