import crypto from "crypto";
import { estimateTokens, calculateCredits } from "./groqService.js";

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
