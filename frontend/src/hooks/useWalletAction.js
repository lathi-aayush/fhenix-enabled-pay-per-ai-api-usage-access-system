import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useMetaMaskLogin } from "../context/MetaMaskLoginContext.jsx";

/**
 * Run an action only when the user has a wallet session.
 * Guests are prompted to connect MetaMask first; on success the action runs immediately.
 * Replaces the MetaMask-based version.
 */
export function useWalletAction() {
  const { isAuthenticated } = useAuth();
  const { connectWithMetaMask } = useMetaMaskLogin();
  const { pathname } = useLocation();

  const runWithWallet = useCallback(
    async (action, { role = "user", redirect } = {}) => {
      if (!isAuthenticated) {
        const ok = await connectWithMetaMask({
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
    [isAuthenticated, connectWithMetaMask, pathname]
  );

  return { runWithWallet, isAuthenticated };
}
