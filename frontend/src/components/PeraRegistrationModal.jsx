import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function PeraRegistrationModal({
  open,
  walletAddress,
  role,
  redirect,
  onClose,
  onComplete,
}) {
  const { register, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [regName, setRegName] = useState("");
  const [nameAvailable, setNameAvailable] = useState(null);
  const [nameError, setNameError] = useState("");
  const [checkingName, setCheckingName] = useState(false);

  useEffect(() => {
    if (!open) {
      setRegName("");
      setNameAvailable(null);
      setNameError("");
    }
  }, [open]);

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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!regName || regName.trim().length < 3) {
      return toast.error("Choose a valid name (at least 3 characters)");
    }
    if (nameAvailable === false) {
      return toast.error("Please choose a unique display name");
    }
    if (!walletAddress) {
      return toast.error("Wallet address missing");
    }
    setBusy(true);
    try {
      await register(walletAddress, role, regName.trim());
      toast.success("Profile set up! Welcome to Sentinal.");
      onComplete?.(redirect);
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
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
            {walletAddress}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-primary rounded-full animate-spin" />
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
                onClose?.();
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
  );
}
