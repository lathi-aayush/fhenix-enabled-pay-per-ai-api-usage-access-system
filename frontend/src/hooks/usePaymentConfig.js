import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { setCachedReceiverWallet } from "../api/studioOverage.js";

const ENV_RECEIVER =
  import.meta.env.VITE_SENTINEL_WALLET_ADDRESS?.trim() ||
  import.meta.env.VITE_RECEIVER_WALLET?.trim() ||
  "";

const DEFAULT_ALGOD =
  import.meta.env.VITE_RPC_URL?.trim() || "https://sepolia.base.org";

export function usePaymentConfig() {
  const [config, setConfig] = useState({
    rpcUrl: DEFAULT_ALGOD,
    receiverWallet: ENV_RECEIVER,
    loading: !ENV_RECEIVER,
  });

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/public/network")
      .then(({ data }) => {
        if (cancelled) return;
        const receiverWallet = data?.receiverWallet?.trim() || ENV_RECEIVER;
        if (receiverWallet) setCachedReceiverWallet(receiverWallet);
        setConfig({
          rpcUrl: data?.rpcUrl?.trim() || DEFAULT_ALGOD,
          receiverWallet,
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setConfig((prev) => ({ ...prev, loading: false }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
