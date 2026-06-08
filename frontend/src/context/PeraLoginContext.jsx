import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "./AuthContext.jsx";
import { connectPera } from "../wallet/pera.js";
import PeraRegistrationModal from "../components/PeraRegistrationModal.jsx";

const PeraLoginContext = createContext(null);

export function PeraLoginProvider({ children }) {
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

  const connectWithPera = useCallback(
    async (options = {}) => {
      const role = options.role || "user";
      const afterLogin =
        options.redirect || (role === "creator" ? "/creator" : "/dashboard/home");
      const shouldNavigate = options.navigate !== false;

      if (isAuthenticated && user) {
        const hasCapability =
          user.role === role || (role === "user" && user.role === "creator");
        if (hasCapability) {
          if (shouldNavigate && options.redirect) navigate(afterLogin);
          return true;
        }
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
          setShowReg(true);
          toast.success("Wallet connected! Choose a display name to finish setup.", {
            id: "pera-login",
            duration: 5000,
          });
          return new Promise((resolve) => {
            regResolveRef.current = resolve;
          });
        }

        toast.success(`Welcome back${res.user.displayName ? `, ${res.user.displayName}` : ""}!`, {
          id: "pera-login",
        });
        if (shouldNavigate) navigate(afterLogin);
        return true;
      } catch (e) {
        console.error(e);
        toast.error(e?.response?.data?.error || e?.message || "Pera Wallet login failed", {
          id: "pera-login",
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [isAuthenticated, user, login, navigate]
  );

  const value = useMemo(
    () => ({
      connectWithPera,
      enterWithPera: connectWithPera,
      busy,
    }),
    [connectWithPera, busy]
  );

  return (
    <PeraLoginContext.Provider value={value}>
      {children}
      <PeraRegistrationModal
        open={showReg}
        walletAddress={regWallet}
        role={regRole}
        redirect={regRedirect}
        onClose={() => {
          setShowReg(false);
          regResolveRef.current?.(false);
          regResolveRef.current = null;
        }}
        onComplete={finishRegistration}
      />
    </PeraLoginContext.Provider>
  );
}

export function usePeraLogin() {
  const ctx = useContext(PeraLoginContext);
  if (!ctx) throw new Error("usePeraLogin must be used within PeraLoginProvider");
  return ctx;
}
