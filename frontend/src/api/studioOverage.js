/**
 * studioOverage.js — Studio overage payment via MetaMask on Sepolia.
 * Replaces the Sepolia/MetaMask version.
 */

import { api } from "./client.js";
import { sendEthPayment } from "../wallet/metamask.js";
import { getTxUrl } from "../utils/explorer.js";

let _cachedReceiverWallet = "";

export function setCachedReceiverWallet(address) {
  _cachedReceiverWallet = String(address || "").trim();
}

export function getOveragePayTo() {
  return (
    import.meta.env.VITE_TREASURY_WALLET?.trim() ||
    import.meta.env.VITE_RECEIVER_WALLET?.trim() ||
    _cachedReceiverWallet ||
    ""
  );
}

/** Resolve pay-to address from env or backend public config. */
export async function resolveOveragePayTo() {
  const fromEnv = getOveragePayTo();
  if (fromEnv) return fromEnv;
  const { data } = await api.get("/api/public/network");
  const wallet = data?.receiverWallet?.trim() || "";
  if (wallet) setCachedReceiverWallet(wallet);
  return wallet;
}

/**
 * Send ETH overage payment via MetaMask and return the tx hash.
 *
 * @param {object} opts
 * @param {string} opts.from         MetaMask connected address
 * @param {string} opts.to           Treasury wallet address
 * @param {bigint|string} opts.amountWei  Amount in wei
 * @returns {Promise<{ txHash: string, xPaymentHeader: string, explorerUrl: string }>}
 */
export async function buildX402PaymentHeader({ from, to, amountWei }) {
  const { txHash } = await sendEthPayment({ from, to, amountWei });

  const payload = {
    txHash,
    network: "eip155:11155111",
    payTo: to,
    amount: amountWei.toString(),
  };
  const xPaymentHeader = btoa(JSON.stringify(payload));

  return { txHash, xPaymentHeader, explorerUrl: getTxUrl(txHash) };
}
