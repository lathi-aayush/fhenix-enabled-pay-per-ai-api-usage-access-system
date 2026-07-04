/**
 * proxyX402Use.js â€” EVM/Sepolia x402 payment for /api/use proxy calls.
 * Replaces the Sepolia version (burner wallet + viem).
 *
 * Uses the session key wallet to sign and submit ETH transfers for x402 calls.
 */

import { api } from "./client.js";
import { getSessionKeyWallet } from "../wallet/sessionKey.js";
import { getTxUrl } from "../utils/explorer.js";

/**
 * Encode the X-Payment header for Sepolia.
 * Format: base64(JSON({ txHash, network, amount, payTo }))
 */
function buildXPaymentHeader({ txHash, accept }) {
  const payload = {
    txHash,
    network: accept.network ?? "eip155:11155111",
    payTo: accept.payTo,
    amount: accept.maxAmountRequired ?? accept.amount,
  };
  return btoa(JSON.stringify(payload));
}

/**
 * Make an x402-authenticated call to POST /api/use using the session key wallet.
 *
 * @param {object} opts
 * @param {string} opts.apiKey       Bearer API key (sk-sentinel-*)
 * @param {string} opts.serviceId    Service MongoDB ID
 * @param {object} opts.body         AI request body
 * @returns {Promise<{ aiResponse, txHash, receipt }>}
 */
export async function callProxyX402Use({ apiKey, serviceId, body }) {
  const headers = { Authorization: `Bearer ${apiKey}` };

  // Step 1: Trigger 402 challenge
  let challengeData;
  try {
    await api.post("/api/use", body, { headers });
    throw new Error("Expected HTTP 402 Payment Required");
  } catch (e) {
    if (e?.response?.status !== 402) {
      const msg = e?.response?.data?.error || e?.response?.data?.detail || e?.message;
      throw new Error(msg || "x402 challenge request failed");
    }
    challengeData = e.response.data;
  }

  const accept = challengeData?.accepts?.[0];
  if (!accept?.payTo || (accept.maxAmountRequired == null && accept.amount == null)) {
    throw new Error("Invalid x402 payment challenge from server");
  }

  const amountWei = BigInt(accept.maxAmountRequired ?? accept.amount);
  if (amountWei <= 0n) throw new Error("Invalid x402 charge amount from server");

  // Step 2: Check session key balance
  const sessionWallet = getSessionKeyWallet();
  const balanceHex = await window.ethereum?.request({
    method: "eth_getBalance",
    params: [sessionWallet.address, "latest"],
  });
  const balance = BigInt(balanceHex || "0x0");

  if (balance < amountWei) {
    throw new Error(
      `Session key wallet has insufficient balance. Required: ${Number(amountWei) / 1e18} ETH. ` +
      `Fund ${sessionWallet.address} from your MetaMask wallet.`
    );
  }

  // Step 3: Send ETH payment via session key relay (backend signs with private key)
  const { txHash } = await (async () => {
    const { data } = await api.post("/api/profile/session-key/send", {
      privateKey: sessionWallet.privateKey,
      to: accept.payTo,
      amountWei: amountWei.toString(),
    });
    return data;
  })();

  // Step 4: Build X-Payment header and retry the AI call
  const xPaymentHeader = buildXPaymentHeader({ txHash, accept });

  const { data: final } = await api.post("/api/use", body, {
    headers: { ...headers, "X-Payment": xPaymentHeader },
  });

  const receipt = final?.sentinelReceipt ?? null;
  const { sentinelReceipt: _sr, ...aiResponse } = final || {};
  const settledTxHash = receipt?.paymentTxHash ?? txHash;

  return {
    aiResponse,
    txHash: settledTxHash,
    receipt,
    explorerUrl: getTxUrl(settledTxHash),
  };
}
