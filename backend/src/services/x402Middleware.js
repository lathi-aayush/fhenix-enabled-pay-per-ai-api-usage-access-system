/**
 * x402 Payment Protocol — Server-Side Middleware for SentinelAI
 *
 * Handles:
 *   1. Building the HTTP 402 Payment-Required response (challenge)
 *   2. Parsing + verifying the X-Payment header sent by x402-aware clients
 *
 * The X-Payment header carries a base64-encoded JSON payload:
 *   { paymentGroup: [base64SignedTx, ...], paymentIndex: number }
 *
 * This module does NOT use the @x402/avm ExactAvmScheme for server verification —
 * instead it decodes the signed transaction bytes directly using algosdk and our
 * existing Algorand utilities, which avoids importing the AlgoKit client and keeps
 * the server-side code lean and testnet-agnostic.
 */

import algosdk from "algosdk";
import {
  decodeSignedTransaction,
  getSenderFromTransaction,
  getTransactionId,
  isExactAvmPayload,
  ALGORAND_TESTNET_CAIP2,
  ALGORAND_TESTNET_GENESIS_HASH,
} from "@x402/avm";
import { x402Version } from "@x402/core";
import {
  lookupConfirmedTransactionOnIndexer,
  normalizeAlgoAddress,
} from "./algorandService.js";
import { microAlgosWithinTolerance } from "./billing.js";

// ─── Constants ──────────────────────────────────────────────────────────────

/** The x402 network identifier for Algorand TestNet */
export const X402_NETWORK = ALGORAND_TESTNET_CAIP2;

/** ALGO asset identifier used in x402 payment requirements (native ALGO = "0") */
export const X402_ALGO_ASSET = "0";

// ─── Build 402 Challenge ─────────────────────────────────────────────────────

/**
 * Constructs the PaymentRequirements object that goes into the
 * `Payment-Required` response header for an HTTP 402 challenge.
 *
 * @param {object} opts
 * @param {string} opts.payTo          Creator's Algorand wallet address
 * @param {number} opts.amountMicroAlgos  Exact microAlgo amount required
 * @param {string} opts.resource       The endpoint URL being protected
 * @param {string} opts.description    Human-readable description of what is being paid for
 * @returns {object} PaymentRequirements payload (to be JSON-serialized into the header)
 */
export function buildPaymentRequirements({ payTo, amountMicroAlgos, resource, description }) {
  return {
    scheme: "exact",
    network: X402_NETWORK,
    maxAmountRequired: String(amountMicroAlgos),
    resource,
    description,
    mimeType: "application/json",
    paymentRequirements: [
      {
        scheme: "exact",
        network: X402_NETWORK,
        maxAmountRequired: String(amountMicroAlgos),
        payTo: normalizeAlgoAddress(payTo),
        asset: X402_ALGO_ASSET,
        extra: {},
      },
    ],
  };
}

/**
 * Sends the HTTP 402 Payment Required response with the correct
 * x402-standard headers and JSON body.
 *
 * @param {import('express').Response} res
 * @param {object} paymentRequirements  Output of buildPaymentRequirements()
 */
export function send402Response(res, paymentRequirements) {
  const body = {
    x402Version,
    error: "Payment Required",
    accepts: paymentRequirements.paymentRequirements,
  };
  res
    .status(402)
    .set("Payment-Required", Buffer.from(JSON.stringify(paymentRequirements)).toString("base64"))
    .json(body);
}

// ─── Parse X-Payment Header ──────────────────────────────────────────────────

/**
 * Parses the raw X-Payment header value.
 *
 * The header is a base64-encoded JSON string conforming to the ExactAvmPayload:
 *   { paymentGroup: [base64SignedTxBytes, ...], paymentIndex: number }
 *
 * @param {string | undefined} headerValue
 * @returns {{ paymentGroup: string[], paymentIndex: number } | null}
 */
export function parseXPaymentHeader(headerValue) {
  if (!headerValue || typeof headerValue !== "string") return null;
  try {
    const decoded = JSON.parse(Buffer.from(headerValue.trim(), "base64").toString("utf8"));
    if (!isExactAvmPayload(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// ─── Verify x402 Payment ─────────────────────────────────────────────────────

/**
 * Fully verifies an x402 payment from a parsed X-Payment payload.
 *
 * Checks:
 *  - The payment transaction is the correct index in the group
 *  - It is a NATIVE ALGO payment (type "pay")
 *  - The genesis hash matches Algorand TestNet
 *  - The receiver matches the creator wallet
 *  - The amount matches the quoted charge (±1%)
 *  - The transaction is confirmed on-chain (via Algorand Indexer)
 *
 * @param {object} opts
 * @param {{ paymentGroup: string[], paymentIndex: number }} opts.payload  Parsed header
 * @param {string}  opts.expectedReceiver  Creator wallet (canonical form)
 * @param {number}  opts.expectedMicroAlgos  Exact amount quoted in the 402
 * @returns {Promise<{ valid: true, txId: string, senderAddress: string } | { valid: false, error: string }>}
 */
export async function verifyX402Payment({ payload, expectedReceiver, expectedMicroAlgos }) {
  try {
    const { paymentGroup, paymentIndex } = payload;

    // 1. Bounds check on the payment index
    if (paymentIndex < 0 || paymentIndex >= paymentGroup.length) {
      return { valid: false, error: `Invalid paymentIndex ${paymentIndex} for group of size ${paymentGroup.length}` };
    }

    // 2. Decode the signed transaction at paymentIndex
    const rawBase64 = paymentGroup[paymentIndex];
    if (!rawBase64 || typeof rawBase64 !== "string") {
      return { valid: false, error: "Missing signed transaction bytes in paymentGroup" };
    }

    let signedTxBytes;
    try {
      signedTxBytes = Buffer.from(rawBase64, "base64");
    } catch {
      return { valid: false, error: "Could not base64-decode payment transaction bytes" };
    }

    // 3. Extract txId and sender using @x402/avm helpers
    let txId;
    let senderAddress;
    let innerTxn;
    try {
      txId = getTransactionId(signedTxBytes);
      senderAddress = getSenderFromTransaction(signedTxBytes, true);

      // Decode to inspect type, amount, receiver, genesis hash
      const decoded = decodeSignedTransaction(signedTxBytes);
      innerTxn = decoded.txn;
    } catch (e) {
      return { valid: false, error: `Could not decode transaction: ${e.message}` };
    }

    // 4. Must be a native ALGO payment transaction (type "pay")
    if (innerTxn.type !== "pay") {
      return { valid: false, error: `Expected native ALGO payment (type "pay"), got "${innerTxn.type}"` };
    }

    // 5. Verify genesis hash = Algorand TestNet
    let txGenHash;
    try {
      txGenHash = Buffer.from(innerTxn.genesisHash).toString("base64");
    } catch {
      return { valid: false, error: "Transaction is missing genesis hash" };
    }
    if (txGenHash !== ALGORAND_TESTNET_GENESIS_HASH) {
      return {
        valid: false,
        error: `Wrong network. Expected TestNet genesis hash "${ALGORAND_TESTNET_GENESIS_HASH}", got "${txGenHash}"`,
      };
    }

    // 6. Verify receiver = creator wallet
    const receiverObj = innerTxn.payment?.receiver || innerTxn.to;
    const txReceiver = normalizeAlgoAddress(receiverObj ? receiverObj.toString() : "");
    const expectedReceiverN = normalizeAlgoAddress(expectedReceiver);
    if (txReceiver !== expectedReceiverN) {
      return {
        valid: false,
        error: `Payment receiver mismatch. Expected ${expectedReceiverN}, got ${txReceiver}`,
      };
    }

    // 7. Verify amount within ±1% tolerance
    const rawAmount = innerTxn.payment?.amount ?? innerTxn.amount ?? 0;
    const txAmountMicro = Number(rawAmount);
    if (!microAlgosWithinTolerance(txAmountMicro, expectedMicroAlgos, 1)) {
      return {
        valid: false,
        error: `Amount mismatch. Expected ~${expectedMicroAlgos} microAlgos (±1%), got ${txAmountMicro}`,
      };
    }

    // 8. Wait for on-chain confirmation via Algorand Indexer
    try {
      await lookupConfirmedTransactionOnIndexer(txId, { maxAttempts: 12, delayMs: 2000 });
    } catch (e) {
      return {
        valid: false,
        error: `Transaction ${txId} not confirmed on Algorand TestNet Indexer: ${e.message}`,
      };
    }

    return { valid: true, txId, senderAddress: normalizeAlgoAddress(senderAddress) };
  } catch (e) {
    console.error("[x402Middleware] verifyX402Payment unexpected error:", e);
    return { valid: false, error: `Internal verification error: ${e.message}` };
  }
}
