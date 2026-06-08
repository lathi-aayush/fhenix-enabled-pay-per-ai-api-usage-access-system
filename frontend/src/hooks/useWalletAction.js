import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { usePeraLogin } from "../context/PeraLoginContext.jsx";

/**
 * Run an action only when the user has a wallet session.
 * Guests are prompted to connect Pera first; on success the action runs immediately.
 */
export function useWalletAction() {
  const { isAuthenticated } = useAuth();
  const { connectWithPera } = usePeraLogin();
  const { pathname } = useLocation();

  const runWithWallet = useCallback(
    async (action, { role = "user", redirect } = {}) => {
      if (!isAuthenticated) {
        const ok = await connectWithPera({
          role,
          redirect: redirect ?? pathname,
          navigate: false,
        });
        if (!ok) return false;
      }
      if (typeof action === "function") {
        return action();
      }
      return true;
    },
    [isAuthenticated, connectWithPera, pathname]
  );

  return { runWithWallet, isAuthenticated };
}
