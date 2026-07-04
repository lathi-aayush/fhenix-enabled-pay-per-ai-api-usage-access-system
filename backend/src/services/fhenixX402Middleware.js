/**
 * fhenixX402Middleware.js — Fhenix/EVM x402 payment middleware
 *
 * Implements HTTP 402 "Payment Required" for AI API call gating on Sepolia.
 * Payment token: native ETH (or FHERC20 when fully deployed — encrypted amounts).
 *
 * Flow:
 *  1. buildPaymentRequirements() → 402 challenge body
 *  2. Client signs ETH transfer, sends X-Payment header
 *  3. verifyX402Payment() → checks receipt on Sepolia
 *  4. AI call proceeds; txHash returned to client for Etherscan proof
 */

import { ethers } from "ethers";
import { getReceiptWithRetry, getTransaction, normalizeEvmAddress, weiWithinTolerance } from "./evmService.js";

// EIP-155 CAIP-2 network identifier for Sepolia
export const X402_NETWORK = "eip155:11155111";

// Native ETH asset identifier (address(0) convention)
export const X402_ETH_ASSET = "0x0000000000000000000000000000000000000000";

const DEFAULT_MAX_TIMEOUT_SECONDS = 120;

function getMaxTimeoutSeconds() {
  const n = Number(process.env.X402_MAX_TIMEOUT_SECONDS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_TIMEOUT_SECONDS;
}

/**
 * Build the PaymentRequirements object for an HTTP 402 response.
 *
 * @param {object} opts
 * @param {string} opts.payTo           Receiver EVM address (creator wallet)
 * @param {bigint|string} opts.amountWei  Exact amount in wei
 * @param {string} opts.resource        Endpoint URL being protected
 * @param {string} opts.description     Human-readable description
 */
export function buildPaymentRequirements({ payTo, amountWei, resource, description }) {
  const receiver = normalizeEvmAddress(payTo);
  return {
    scheme: "exact",
    network: X402_NETWORK,
    maxAmountRequired: String(amountWei),
    resource,
    description,
    mimeType: "application/json",
    paymentRequirements: [
      {
        scheme: "exact",
        network: X402_NETWORK,
        maxAmountRequired: String(amountWei),
        payTo: receiver,
        asset: X402_ETH_ASSET,
        maxTimeoutSeconds: getMaxTimeoutSeconds(),
        extra: { decimals: 18, name: "ETH", chain: "Sepolia" },
      },
    ],
  };
}

/**
 * Send the HTTP 402 response with payment requirements.
 *
 * @param {import('express').Response} res
 * @param {object} paymentRequirements  Output of buildPaymentRequirements()
 */
export function send402Response(res, paymentRequirements) {
  const body = {
    x402Version: 1,
    error: "Payment Required",
    accepts: paymentRequirements.paymentRequirements,
  };
  res
    .status(402)
    .set("Payment-Required", Buffer.from(JSON.stringify(paymentRequirements)).toString("base64"))
    .json(body);
}

/**
 * Decode the X-Payment header sent by the client.
 * Expected format: base64(JSON({ txHash: "0x...", network: "eip155:11155111" }))
 */
export function decodeXPaymentHeader(headerValue) {
  if (!headerValue || typeof headerValue !== "string") return null;
  try {
    return JSON.parse(Buffer.from(headerValue.trim(), "base64").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Verify an x402 payment by checking the on-chain transaction receipt.
 *
 * @param {object} opts
 * @param {string} opts.xPaymentHeader  Raw X-Payment header value
 * @param {string} opts.expectedReceiver  EVM address that should receive payment
 * @param {bigint|string} opts.expectedWei  Amount that should be sent
 * @param {string} [opts.resource]
 * @param {string} [opts.description]
 * @returns {Promise<{ valid: true, txHash: string, senderAddress: string } | { valid: false, error: string }>}
 */
export async function verifyX402Payment({
  xPaymentHeader,
  expectedReceiver,
  expectedWei,
  resource,
  description,
}) {
  try {
    const decoded = decodeXPaymentHeader(xPaymentHeader);
    if (!decoded?.txHash) {
      return { valid: false, error: "X-Payment header missing txHash" };
    }

    const { txHash } = decoded;

    // Wait for receipt (confirms tx landed on-chain)
    let receipt;
    try {
      receipt = await getReceiptWithRetry(txHash, { tries: 12, delayMs: 2000 });
    } catch (e) {
      return { valid: false, error: `Transaction not confirmed: ${e.message}` };
    }

    if (receipt.status !== 1) {
      return { valid: false, error: "Transaction reverted on-chain" };
    }

    // Get full tx to check value and receiver
    const tx = await getTransaction(txHash);
    if (!tx) {
      return { valid: false, error: "Transaction not found after receipt" };
    }

    const receiverNorm = normalizeEvmAddress(expectedReceiver);
    const txReceiver = normalizeEvmAddress(tx.to);
    if (txReceiver !== receiverNorm) {
      return {
        valid: false,
        error: `Receiver mismatch. Expected ${receiverNorm}, got ${txReceiver}`,
      };
    }

    if (!weiWithinTolerance(tx.value, BigInt(expectedWei), 1)) {
      return {
        valid: false,
        error: `Amount mismatch. Expected ~${expectedWei} wei (±1%), got ${tx.value.toString()}`,
      };
    }

    return {
      valid: true,
      txHash,
      senderAddress: normalizeEvmAddress(tx.from),
    };
  } catch (e) {
    console.error("[fhenixX402] verifyX402Payment unexpected error:", e);
    return { valid: false, error: `Internal verification error: ${e.message}` };
  }
}
