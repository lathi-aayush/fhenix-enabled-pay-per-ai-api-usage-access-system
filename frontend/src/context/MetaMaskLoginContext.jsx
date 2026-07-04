/**
 * MetaMaskLoginContext — replaces MetaMaskLoginContext.jsx
 *
 * Provides connectWithMetaMask() for login/registration flows.
 * Wraps MetaMask connection + backend JWT auth in a single context.
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "./AuthContext.jsx";
import { connectMetaMask, isMetaMaskInstalled } from "../wallet/metamask.js";

const MetaMaskLoginContext = createContext(null);

export function MetaMaskLoginProvider({ children }) {
  const navigate = useNavigate();
  const { login, user, isAuthenticated } = useAuth();
  const [busy, setBusy] = useState(false);
  const [showReg, setShowReg] = useState(false);
  const [regRole, setRegRole] = useState("user");
  const [regWallet, setRegWallet] = useState("");
  const [regRedirect, setRegRedirect] = useState("/dashboard/home");
  const regResolveRef = useRef(null);

  const finishRegistration = useCallback(
    (redirect) => {
      setShowReg(false);
      const target = redirect || regRedirect || "/dashboard/home";
      navigate(regRole === "creator" ? "/creator" : target);
      regResolveRef.current?.(true);
      regResolveRef.current = null;
    },
    [navigate, regRedirect, regRole]
  );

  const connectWithMetaMask = useCallback(
    async (options = {}) => {
      const role = options.role || "user";
      const afterLogin = options.redirect || (role === "creator" ? "/creator" : "/dashboard/home");
      const shouldNavigate = options.navigate !== false;

      if (isAuthenticated && user) {
        const hasCapability = user.role === role || (role === "user" && user.role === "creator");
        if (hasCapability) {
          if (shouldNavigate && options.redirect) navigate(afterLogin);
          return true;
        }
      }

      setBusy(true);
      try {
        if (!isMetaMaskInstalled()) {
          toast.error("MetaMask not detected. Open this app in Chrome or Brave with the MetaMask extension installed.", {
            id: "mm-login",
            duration: 6000,
          });
          return false;
        }

        toast.loading("Connecting MetaMask...", { id: "mm-login" });
        const addr = await connectMetaMask();
        toast.loading("Signing in...", { id: "mm-login" });

        const res = await login(addr, role);

        if (res.needsProfile || res.isNewUser) {
          setRegWallet(addr);
          setRegRole(role);
          setRegRedirect(afterLogin);
          setShowReg(true);
          toast.success("Wallet connected! Choose a display name to finish setup.", {
            id: "mm-login",
            duration: 5000,
          });
          return new Promise((resolve) => {
            regResolveRef.current = resolve;
          });
        }

        toast.success(`Welcome back${res.user?.displayName ? `, ${res.user.displayName}` : ""}!`, {
          id: "mm-login",
        });
        if (shouldNavigate) navigate(afterLogin);
        return true;
      } catch (e) {
        if (!String(e?.message || "").includes("MetaMask is not installed")) {
          console.error(e);
        }
        toast.error(e?.response?.data?.error || e?.message || "MetaMask login failed", {
          id: "mm-login",
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [isAuthenticated, user, login, navigate]
  );

  const value = useMemo(
    () => ({ connectWithMetaMask, enterWithMetaMask: connectWithMetaMask, busy }),
    [connectWithMetaMask, busy]
  );

  return (
    <MetaMaskLoginContext.Provider value={value}>
      {children}
      {showReg && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
          }}
        >
          <div style={{ background: "#1a1a2e", padding: 32, borderRadius: 12, minWidth: 340 }}>
            <h2 style={{ color: "#fff", marginBottom: 8 }}>Choose a display name</h2>
            <p style={{ color: "#aaa", marginBottom: 16, fontSize: 14 }}>
              Wallet: {regWallet?.slice(0, 6)}...{regWallet?.slice(-4)}
            </p>
            <RegistrationForm
              walletAddress={regWallet}
              role={regRole}
              redirect={regRedirect}
              onComplete={finishRegistration}
              onClose={() => {
                setShowReg(false);
                regResolveRef.current?.(false);
                regResolveRef.current = null;
              }}
            />
          </div>
        </div>
      )}
    </MetaMaskLoginContext.Provider>
  );
}

function RegistrationForm({ walletAddress, role, redirect, onComplete, onClose }) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 3) {
      setError("Name must be at least 3 characters");
      return;
    }
    setBusy(true);
    try {
      await register(walletAddress, role, name.trim());
      onComplete(redirect);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Display name (3–30 chars)"
        value={name}
        onChange={(e) => { setName(e.target.value); setError(""); }}
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 8,
          border: "1px solid #333", background: "#111", color: "#fff",
          fontSize: 14, marginBottom: 8, boxSizing: "border-box",
        }}
        maxLength={30}
        autoFocus
      />
      {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={busy}
          style={{
            flex: 1, padding: "10px 0", borderRadius: 8,
            background: busy ? "#333" : "#6366f1", color: "#fff",
            border: "none", cursor: busy ? "not-allowed" : "pointer", fontSize: 14,
          }}
        >
          {busy ? "Creating…" : "Continue"}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "10px 16px", borderRadius: 8, background: "transparent",
            color: "#aaa", border: "1px solid #333", cursor: "pointer", fontSize: 14,
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function useMetaMaskLogin() {
  const ctx = useContext(MetaMaskLoginContext);
  if (!ctx) throw new Error("useMetaMaskLogin must be used within MetaMaskLoginProvider");
  return ctx;
}
