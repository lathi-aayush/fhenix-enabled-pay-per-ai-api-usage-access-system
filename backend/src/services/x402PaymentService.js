import crypto from "crypto";
import algosdk from "algosdk";
import { estimateTokens, calculateCredits } from "./groqService.js";
import { User } from "../models/User.js";
import { WorkflowRun } from "../models/WorkflowRun.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { decryptSecret } from "../utils/encrypt.js";
import {
  lookupConfirmedTransactionOnIndexer,
  parsePaymentFromIndexer,
  decodeNote,
  normalizeAlgoAddress,
} from "./algorandService.js";
import { microAlgosWithinTolerance } from "./billing.js";

/**
 * x402-style payment gate integrated with existing burner wallet flow.
 * Uses ALGO credit estimates; frontend sends paymentProof (txId) after burner signs.
 */

export function estimateRunCost(workflow) {
  const nodes = workflow?.nodes || [];
  let estimatedTokens = 0;
  for (const node of nodes) {
    if (node.type === "ai") {
      const prompt = `${node.data?.systemPrompt || ""}\n${node.data?.value || ""}`;
      estimatedTokens += estimateTokens(prompt) + (node.data?.maxTokens || 512);
    }
    if (node.type === "blog") {
      estimatedTokens += (node.data?.wordCount || 1000) + 800;
    }
    if (node.type === "promptGen") {
      estimatedTokens += 1200;
    }
    if (node.type === "imageGen") {
      estimatedTokens += 800;
    }
    if (node.type === "agenticText") estimatedTokens += 1500;
    if (node.type === "agenticImage") estimatedTokens += 2000;
    if (node.type === "agenticVideo") estimatedTokens += 2500;
    if (node.type === "agenticAudio") estimatedTokens += 600;
    if (node.type === "agenticCode") estimatedTokens += 1000;
  }
  const estimatedCredits =
    nodes.reduce((sum, n) => sum + (n.data?.estimatedCredits || 0), 0) ||
    calculateCredits(estimatedTokens) ||
    0.001;
  return {
    estimatedCredits: Math.max(0.0001, Number(estimatedCredits.toFixed(6))),
    estimatedTokens,
  };
}

export function createPaymentChallenge(userId, workflowId, runId, estimatedCredits) {
  const recipient =
    process.env.X402_CONTRACT_ADDRESS ||
    process.env.TREASURY_WALLET ||
    process.env.RECEIVER_WALLET ||
    "";
  return {
    protocol: "x402-sentinal-v1",
    amount: estimatedCredits,
    currency: "ALGO",
    recipient,
    metadata: {
      workflowId: String(workflowId),
      runId: String(runId),
      userId: String(userId),
      nonce: crypto.randomBytes(8).toString("hex"),
    },
    message: `Workflow run requires ~${estimatedCredits} ALGO (burner wallet)`,
  };
}

export async function verifyAndCharge({ paymentProof, challenge, estimatedCredits }) {
  if (!paymentProof) {
    return { success: false, error: "paymentProof required" };
  }
  const txHash =
    typeof paymentProof === "string"
      ? paymentProof
      : paymentProof.txId || paymentProof.txHash || paymentProof.transactionId;
  if (!txHash) {
    return { success: false, error: "Invalid payment proof" };
  }

  // 1. Replay Protection: ensure the transaction has not already been used
  const usedInWorkflow = await WorkflowRun.findOne({ txHash });
  const usedInApi = await ApiUsageLog.findOne({ paymentTxId: txHash });
  if (usedInWorkflow || usedInApi) {
    return {
      success: false,
      error: "Replay attack detected: transaction has already been used to fund a previous run or call",
    };
  }

  // 2. Fetch on-chain transaction from Indexer
  let txInfo;
  try {
    txInfo = await lookupConfirmedTransactionOnIndexer(txHash, {
      maxAttempts: 10,
      delayMs: 2000,
    });
  } catch (err) {
    return {
      success: false,
      error: `Payment verification failed: ${err.message}`,
    };
  }

  // 3. Parse payment details
  const parsed = parsePaymentFromIndexer(txInfo);
  if (!parsed) {
    return {
      success: false,
      error: "Invalid transaction type: expected standard ALGO payment transaction",
    };
  }

  const { sender, receiver, amount, note } = parsed;

  // 4. Verify Recipient Wallet Address
  const expectedReceiver = normalizeAlgoAddress(challenge.recipient);
  const actualReceiver = normalizeAlgoAddress(receiver);
  if (actualReceiver !== expectedReceiver) {
    return {
      success: false,
      error: `Recipient mismatch. Expected treasury/receiver ${expectedReceiver}, got ${actualReceiver}`,
    };
  }

  // 5. Verify Note / Workflow Reference Integrity
  const decodedNote = decodeNote(note).trim();
  const expectedNote = `workflow:${challenge.metadata.workflowId}`;
  if (decodedNote !== expectedNote) {
    return {
      success: false,
      error: `Transaction note mismatch. Expected '${expectedNote}', got '${decodedNote}'`,
    };
  }

  // 6. Verify Amount Paid
  const expectedMicroAlgos = Math.max(1000, Math.ceil(challenge.amount * 1_000_000));
  if (!microAlgosWithinTolerance(Number(amount), expectedMicroAlgos, 1)) {
    return {
      success: false,
      error: `Payment amount does not match. Expected ~${expectedMicroAlgos} microAlgos, got ${amount} microAlgos`,
    };
  }

  // 7. Verify Sender Wallet Address (matches user's burner or primary wallet)
  const user = await User.findById(challenge.metadata.userId);
  if (!user) {
    return {
      success: false,
      error: "User not found associated with this workflow challenge",
    };
  }

  const expectedSenders = [];
  if (user.walletAddress) {
    expectedSenders.push(normalizeAlgoAddress(user.walletAddress));
  }
  if (user.burnerWalletEncrypted) {
    try {
      const mnemonic = decryptSecret(user.burnerWalletEncrypted);
      const keys = algosdk.mnemonicToSecretKey(mnemonic.trim());
      expectedSenders.push(normalizeAlgoAddress(keys.addr));
    } catch (err) {
      console.error("[verifyAndCharge] Burner wallet decryption error:", err);
    }
  }

  const actualSender = normalizeAlgoAddress(sender);
  if (!expectedSenders.includes(actualSender)) {
    return {
      success: false,
      error: "Sender address mismatch. Transaction must be signed by the user's registered wallet or burner wallet.",
    };
  }

  return {
    success: true,
    txHash,
    actualAmount: estimatedCredits,
    verified: true,
  };
}

export function refundOverpayment(txHash, actualCredits, estimatedCredits) {
  const diff = estimatedCredits - actualCredits;
  if (diff <= 0.000001) return { success: true, refunded: 0 };
  return { success: true, refunded: diff, note: "Refund recorded; manual settlement if needed", txHash };
}

export async function logTransaction(userId, workflowId, runId, txHash, amount, status) {
  return {
    userId: String(userId),
    workflowId: String(workflowId),
    runId: String(runId),
    txHash,
    amount,
    status,
  };
}
