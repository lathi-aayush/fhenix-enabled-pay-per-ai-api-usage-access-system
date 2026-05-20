import React from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import { useEffect, useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../config/firebase.js";
import ContractStats from "../components/ContractStats.jsx";
import ProfileDropdown from "../components/ProfileDropdown.jsx";
import { connectPera } from "../wallet/pera.js";
import { api } from "../api/client.js";
import HowItWorks from "../components/HowItWorks.jsx";

export default function Home() {
  const isConfigured = !!import.meta.env.VITE_FIREBASE_API_KEY;
  const navigate = useNavigate();
  const { firebaseLogin, register, linkWallet, user, logout, isAuthenticated } = useAuth();
  const [busy, setBusy] = useState(false);

  // New Registration Modal State
  const [showReg, setShowReg] = useState(false);
  const [regRole, setRegRole] = useState("user");
  const [regIdToken, setRegIdToken] = useState("");
  const [regName, setRegName] = useState("");
  const [regWallet, setRegWallet] = useState("");
  const [nameAvailable, setNameAvailable] = useState(null);
  const [nameError, setNameError] = useState("");
  const [checkingName, setCheckingName] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(false);

  // Custom Simulator States
  const [showSimModal, setShowSimModal] = useState(false);
  const [simRole, setSimRole] = useState("creator");
  const [simEmail, setSimEmail] = useState("");

  const [mockMode, setMockMode] = useState(() => {
    const saved = localStorage.getItem("sentinal_mock_mode");
    return saved === "true";
  });

  const toggleMockMode = () => {
    const nextVal = !mockMode;
    setMockMode(nextVal);
    localStorage.setItem("sentinal_mock_mode", String(nextVal));
    toast.success(nextVal ? "Developer Mock Mode Activated!" : "Real Firebase Google Auth Engaged!");
  };

  // Live Name Checking with Debounce
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
      } catch (err) {
        setNameAvailable(null);
      } finally {
        setCheckingName(false);
      }
    }, 450);

    return () => clearTimeout(delay);
  }, [regName]);

  async function handleRegWalletConnect() {
    setConnectingWallet(true);
    try {
      const addr = await connectPera();
      setRegWallet(addr);
      toast.success("Wallet address linked to registration!");
    } catch (e) {
      toast.error(e?.message || "Failed to connect Pera Wallet");
    } finally {
      setConnectingWallet(false);
    }
  }

  async function handleFinalizeRegistration(e) {
    e.preventDefault();
    if (!regName || regName.trim().length < 3) {
      return toast.error("Choose a valid name (at least 3 characters)");
    }
    if (nameAvailable === false) {
      return toast.error("Please choose a unique display name");
    }
    if (!regWallet) {
      return toast.error("Please connect your Pera Wallet to complete sign-up");
    }
    setBusy(true);
    try {
      await register(regIdToken, regRole, regName.trim(), regWallet);
      toast.success("Account successfully created! Direct login complete.");
      setShowReg(false);
      navigate(regRole === "creator" ? "/creator" : "/dashboard/home");
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  async function enterWithGoogle(role) {
    if (isAuthenticated && user && user.role !== role) {
      toast.error("Log out first, then enter as the other role.");
      return;
    }
    if (isAuthenticated && user && user.role === role) {
      navigate(role === "creator" ? "/creator" : "/dashboard/home");
      return;
    }

    const useMock = !isConfigured || mockMode;
    if (useMock) {
      setSimRole(role);
      setSimEmail(role === "creator" ? "creator-dev@example.com" : "user-dev@example.com");
      setShowSimModal(true);
      return;
    }

    setBusy(true);
    try {
      let idToken;
      const result = await signInWithPopup(auth, googleProvider);
      idToken = await result.user.getIdToken();

      const res = await firebaseLogin(idToken, role);
      
      if (res.isNewUser) {
        // Show setup / registration wizard for NEW ACCOUNTS only!
        setRegIdToken(idToken);
        setRegRole(role);
        setRegName(res.displayName || "");
        setRegWallet("");
        setShowReg(true);
        toast.success("Google verified! Complete your one-time profile setup.", { duration: 6000 });
      } else {
        toast.success(`Welcome back, ${res.user.displayName || "Google User"}!`);
        navigate(role === "creator" ? "/creator" : "/dashboard/home");
      }
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Google Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSimulatedLogin(e) {
    if (e) e.preventDefault();
    if (!simEmail.trim()) {
      toast.error("Please enter a valid email address");
      return;
    }
    setBusy(true);
    setShowSimModal(false);
    try {
      const email = simEmail.trim();
      const safeEmail = email.replace(/[|]/g, "");
      const localPart = safeEmail.split("@")[0] || "dev";
      const name = localPart.charAt(0).toUpperCase() + localPart.slice(1);
      const uid = `mockuid_${simRole}_${safeEmail.replace(/[^a-zA-Z0-9]/g, "")}`;
      
      const idToken = `mock-google-token|${safeEmail}|${name}|${uid}`;
      toast.success(`Simulating Google Auth for: ${safeEmail}`);

      const res = await firebaseLogin(idToken, simRole);
      
      if (res.isNewUser) {
        // Show setup / registration wizard for NEW ACCOUNTS only!
        setRegIdToken(idToken);
        setRegRole(simRole);
        setRegName(res.displayName || "");
        setRegWallet("");
        setShowReg(true);
        toast.success("Google verified! Complete your one-time profile setup.", { duration: 6000 });
      } else {
        toast.success(`Welcome back, ${res.user.displayName || "Google User"}!`);
        navigate(simRole === "creator" ? "/creator" : "/dashboard/home");
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || err?.message || "Simulation failed");
    } finally {
      setBusy(false);
    }
  }

  const handleGenerateRandomEmail = () => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    setSimEmail(`tester${randomNum}@example.com`);
    toast.success("Generated random tester email!");
  };

  return (
    <div className="bg-surface selection:bg-secondary-container selection:text-on-secondary-container min-h-screen">
      <header className="bg-[#F9F9F9] dark:bg-[#1A1C1C] flex justify-between items-center w-full px-8 h-16 max-w-screen-2xl mx-auto top-0 sticky z-50">
        <div className="flex items-center gap-12">
          <Link to="/" className="text-xl font-semibold text-[#031634] dark:text-white tracking-tighter font-headline">
            Sentinal
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#how-it-works"
              className="text-[#5A5A5A] dark:text-[#A0A0A0] text-sm font-medium font-body hover:text-[#031634] dark:hover:text-white transition-colors cursor-pointer"
            >
              How It Works
            </a>
            <a
              href="#marketplace"
              className="text-[#5A5A5A] dark:text-[#A0A0A0] text-sm font-medium font-body hover:text-[#031634] dark:hover:text-white transition-colors cursor-pointer"
            >
              Marketplace
            </a>
            <a
              href="#studio"
              className="text-[#5A5A5A] dark:text-[#A0A0A0] text-sm font-medium font-body hover:text-[#031634] dark:hover:text-white transition-colors cursor-pointer"
            >
              Studio
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <ProfileDropdown />
          ) : (
            <span className="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full uppercase tracking-wider font-body">
              Google Auth First
            </span>
          )}
        </div>
      </header>

      <main>
        <HowItWorks enterWithGoogle={enterWithGoogle} />

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
                onClick={() => (isAuthenticated ? navigate("/dashboard/home") : enterWithGoogle("user"))}
                className="px-5 py-2.5 bg-[#031634] text-white rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Explore Marketplace
              </button>
              <button
                type="button"
                onClick={() => (isAuthenticated ? navigate("/studio") : enterWithGoogle("user"))}
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
              onClick={() => (isAuthenticated ? navigate("/dashboard/home") : enterWithGoogle("user"))}
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
              onClick={() => (isAuthenticated ? navigate("/studio") : enterWithGoogle("user"))}
              className="mt-4 text-sm font-semibold text-indigo-600 underline"
            >
              Open Studio
            </button>
          </div>
        </section>

        <section id="studio" className="max-w-screen-2xl mx-auto px-8 py-12 flex flex-col items-center scroll-mt-20">
          {/* Sleek Developer Mode Pill */}
          <div className="mb-10 w-full max-w-[680px] flex justify-center">
            <div className="inline-flex items-center gap-4 bg-white/60 dark:bg-[#1A1C1C]/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 rounded-full py-2 px-3 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-2 pl-2">
                <span className={`material-symbols-outlined text-[18px] transition-colors ${mockMode ? "text-emerald-500" : "text-[#031634] dark:text-blue-400"}`}>
                  {mockMode ? "science" : "security"}
                </span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider leading-none mb-0.5">
                    Auth Mode
                  </span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium leading-none">
                    {mockMode ? "Simulated Tester Mode" : "Real Google Firebase"}
                  </span>
                </div>
              </div>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700/50 mx-1"></div>
              <button
                type="button"
                onClick={toggleMockMode}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                  mockMode 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50" 
                    : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {mockMode ? "toggle_on" : "toggle_off"}
                </span>
                {mockMode ? "Switch to Real" : "Switch to Sim"}
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 w-full max-w-[680px]">
            <button
              type="button"
              disabled={busy}
              onClick={() => enterWithGoogle("creator")}
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
                  <span className="text-sm font-semibold font-body tracking-wide">Continue with Google</span>
                  <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </div>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => enterWithGoogle("user")}
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
                  <span className="text-sm font-semibold font-body tracking-wide">Continue with Google</span>
                  <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </div>
              </div>
            </button>
          </div>
          <p className="mt-8 font-body text-[12px] text-on-surface-variant/70 italic">
            Log in securely via Google, then link your Pera Wallet on your dashboard.
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

      {/* Premium Registration & Account Setup Modal */}
      {showReg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white dark:bg-[#1A1C1C] border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl max-w-md w-full p-8 relative flex flex-col gap-6">
            
            <div className="flex flex-col gap-2">
              <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 font-bold tracking-wider text-[10px] rounded-full w-max uppercase">
                One-Time Account Setup
              </span>
              <h2 className="text-2xl font-bold font-headline text-slate-900 dark:text-white">
                Welcome to Sentinal
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                To complete your registration, choose a unique display name and link your Algorand wallet address.
              </p>
            </div>

            <form onSubmit={handleFinalizeRegistration} className="flex flex-col gap-5">
              {/* Display Name Input */}
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
                  {/* Status Indicator */}
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
                  <span className="text-[10px] text-rose-500 font-medium mt-0.5">
                    {nameError}
                  </span>
                )}
                {nameAvailable && !nameError && regName.trim().length >= 3 && (
                  <span className="text-[10px] text-emerald-500 font-medium mt-0.5">
                    Username available!
                  </span>
                )}
              </div>

              {/* Pera Wallet QR scan link */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Algorand Pera Wallet
                </label>
                
                {regWallet ? (
                  <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-emerald-500 text-lg">
                        account_balance_wallet
                      </span>
                      <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400 font-bold truncate max-w-[200px]">
                        {regWallet}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRegWallet("")}
                      className="text-xs text-rose-500 hover:text-rose-700 font-bold hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={connectingWallet}
                    onClick={handleRegWalletConnect}
                    className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 w-full"
                  >
                    {connectingWallet ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-500 border-t-slate-800 rounded-full animate-spin"></div>
                        Scanning Pera Code...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">qr_code_scanner</span>
                        Scan Pera Wallet Code
                      </>
                    )}
                  </button>
                )}
                <p className="text-[10px] text-slate-450 dark:text-slate-500">
                  Scanning links your address securely to this account for per-use billing.
                </p>
              </div>

              {/* Submit / Cancel Buttons */}
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
                  disabled={busy || !regWallet || nameAvailable !== true}
                  className="flex-1 bg-[#031634] hover:bg-[#031634]/90 dark:bg-white dark:text-[#031634] text-white py-3 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? "Registering..." : "Register & Enter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Premium Glassmorphic Simulation Modal */}
      {showSimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 duration-200 text-left font-body text-slate-800 dark:text-slate-100">
            
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-500">science</span>
                  <h3 className="font-headline font-bold text-xl text-slate-900 dark:text-white">
                    Simulate Google Login
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Simulate logging in or registering as a fresh Google identity.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSimModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Simulated User Info Panel */}
            <form onSubmit={handleSimulatedLogin} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Target Role
                </span>
                <span className="text-xs font-semibold text-[#031634] dark:text-emerald-400 capitalize bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 px-3 py-2 rounded-xl">
                  {simRole} Account
                </span>
              </div>

              {/* Email Address Input */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Simulated Email Address
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomEmail}
                    className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Generate Random Tester Email
                  </button>
                </div>
                <input
                  type="email"
                  required
                  value={simEmail}
                  onChange={(e) => setSimEmail(e.target.value)}
                  placeholder="e.g. user2@example.com"
                  className="px-4 py-3 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl text-sm focus:outline-none focus:border-[#031634] dark:focus:border-emerald-500 dark:text-white"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                  💡 Type a completely new email (e.g. <span className="font-mono">testuser8@example.com</span>) to trigger a fresh registration setup wizard. Type an existing email to log back into that exact account!
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowSimModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 bg-[#031634] hover:bg-[#031634]/90 dark:bg-white dark:text-[#031634] text-white py-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  {busy ? "Simulating..." : "Simulate Login & Enter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Developer Settings Panel */}
      {isConfigured && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-white/95 dark:bg-[#1A1C1C]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-[#031634] dark:text-white uppercase tracking-wider">
              Developer Settings
            </span>
            <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
              {mockMode ? "Simulating Mock Logins" : "Using Real Firebase"}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleMockMode}
            className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-250 cursor-pointer relative ${
              mockMode ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-700"
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-250 ${
                mockMode ? "translate-x-5" : "translate-x-0"
              }`}
            ></div>
          </button>
        </div>
      )}
    </div>
  );
}
