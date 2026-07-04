import crypto from "crypto";
import { estimateTokens, calculateCredits } from "./groqService.js";
import { User } from "../models/User.js";
import { WorkflowRun } from "../models/WorkflowRun.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import {
  getReceiptWithRetry,
  parseEthTransferFromTx,
  normalizeEvmAddress,
} from "./evmService.js";
import { weiWithinTolerance } from "./billing.js";

/**
 * x402-style payment gate integrated with existing session key wallet flow.
 * Uses ETH credit estimates; frontend sends paymentProof (txHash) after signing.
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
    process.env.TREASURY_WALLET_ADDRESS ||
    process.env.RECEIVER_WALLET ||
    "";
  return {
    protocol: "x402-sentinal-v1",
    amount: estimatedCredits,
    currency: "ETH",
    recipient,
    metadata: {
      workflowId: String(workflowId),
      runId: String(runId),
      userId: String(userId),
      nonce: crypto.randomBytes(8).toString("hex"),
    },
    message: `Workflow run requires ~${estimatedCredits} ETH (session key wallet)`,
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

  const usedInWorkflow = await WorkflowRun.findOne({ txHash });
  const usedInApi = await ApiUsageLog.findOne({ paymentTxId: txHash });
  if (usedInWorkflow || usedInApi) {
    return {
      success: false,
      error: "Replay attack detected: transaction has already been used to fund a previous run or call",
    };
  }

  let receipt;
  try {
    receipt = await getReceiptWithRetry(txHash, { tries: 10, delayMs: 2000 });
  } catch (err) {
    return {
      success: false,
      error: `Payment verification failed: ${err.message}`,
    };
  }

  if (!receipt || receipt.status !== 1) {
    return {
      success: false,
      error: "Transaction failed or not confirmed on-chain",
    };
  }

  const parsed = await parseEthTransferFromTx(txHash);
  if (!parsed) {
    return {
      success: false,
      error: "Invalid transaction type: expected native ETH payment",
    };
  }

  const { sender, receiver, amountWei } = parsed;

  const expectedReceiver = normalizeEvmAddress(challenge.recipient);
  const actualReceiver = normalizeEvmAddress(receiver);
  if (actualReceiver !== expectedReceiver) {
    return {
      success: false,
      error: `Recipient mismatch. Expected treasury/receiver ${expectedReceiver}, got ${actualReceiver}`,
    };
  }

  const expectedWei = BigInt(Math.max(1, Math.ceil(challenge.amount * 1e18)));
  if (!weiWithinTolerance(amountWei, expectedWei, 1)) {
    return {
      success: false,
      error: `Payment amount does not match. Expected ~${expectedWei} wei, got ${amountWei} wei`,
    };
  }

  const user = await User.findById(challenge.metadata.userId);
  if (!user) {
    return {
      success: false,
      error: "User not found associated with this workflow challenge",
    };
  }

  const expectedSenders = [];
  if (user.walletAddress) {
    expectedSenders.push(normalizeEvmAddress(user.walletAddress));
  }

  const actualSender = normalizeEvmAddress(sender);
  if (expectedSenders.length > 0 && !expectedSenders.includes(actualSender)) {
    return {
      success: false,
      error: "Sender address mismatch. Transaction must be signed by the user's linked wallet.",
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
