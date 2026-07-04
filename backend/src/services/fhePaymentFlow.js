/**
 * Shared FHE prepaid balance payment — encrypt charge, deductForCall, proxy AI.
 */

import { ethers } from "ethers";
import { ApiUsageLog } from "../models/ApiUsageLog.js";
import { notifyCreatorPurchaseWebhooks } from "../services/creatorWebhookDispatcher.js";
import {
  computeChargeEth,
  estimateTokensFromOpenAiMessages,
  extractTokenUsage,
} from "../services/billing.js";
import { forwardChatCompletion } from "../services/aiProxy.js";
import {
  deductFheBalance,
  hasFheBalance,
  isFheConfigured,
} from "../services/fheDeductionService.js";
import { isValidEvmAddress, normalizeEvmAddress } from "../services/evmService.js";
import { decryptSecret } from "../utils/encrypt.js";
import { canonicalWalletAddress } from "../utils/userWallet.js";

/**
 * Try paying from encrypted on-chain balance and return AI response.
 * @returns {{ handled: false } | { handled: true, status: number, body: object }}
 */
export async function tryFheAiPayment({
  userWallet: rawUserWallet,
  service,
  aiBody,
  accessTokenId = null,
}) {
  if (!isFheConfigured() || !aiBody) return { handled: false };

  const userWallet = canonicalWalletAddress(rawUserWallet);
  const creatorWallet = normalizeEvmAddress(String(service.creatorWallet || "").trim());
  if (!creatorWallet || !isValidEvmAddress(creatorWallet)) return { handled: false };

  const chargeEth = Number(service.minimumChargeEth);
  const expectedWei = ethers.parseEther(String(chargeEth));
  if (expectedWei <= 0n) return { handled: false };

  if (!(await hasFheBalance(userWallet))) return { handled: false };

  const deduct = await deductFheBalance({
    userWallet,
    amountWei: expectedWei,
    serviceWallet: creatorWallet,
  });
  if (!deduct.ok) return { handled: false };

  const alreadyUsed = await ApiUsageLog.findOne({
    paymentTxId: deduct.txHash,
    success: true,
  });
  if (alreadyUsed) {
    return {
      handled: true,
      status: 409,
      body: { error: "This FHE deduction has already been used" },
    };
  }

  let providerKey;
  try {
    providerKey = decryptSecret(service.encryptedApiKey);
  } catch (e) {
    console.error("[fhe] decryptSecret", e);
    return { handled: true, status: 500, body: { error: "Server configuration error" } };
  }

  let aiResponse;
  try {
    aiResponse = await forwardChatCompletion({
      provider: service.aiProvider,
      apiKey: providerKey,
      model: service.modelName,
      body: aiBody,
      customEndpointUrl: service.customEndpointUrl || "",
    });
    providerKey = null;
  } catch (err) {
    providerKey = null;
    console.error("[fhe] AI provider error:", err?.message || err);
    try {
      await ApiUsageLog.create({
        userWallet,
        serviceId: service._id,
        accessTokenId,
        developerWallet: creatorWallet,
        amountEth: chargeEth,
        aiProvider: service.aiProvider,
        modelName: service.modelName,
        paymentTxId: deduct.txHash,
        fheDeductTxHash: deduct.txHash,
        success: false,
        fhePayment: true,
        errorDetail: String(err?.message || err).slice(0, 500),
      });
    } catch (logErr) {
      console.error("[fhe] failed-call log error:", logErr);
    }
    const status = err.status && Number.isFinite(err.status) ? err.status : 502;
    return {
      handled: true,
      status,
      body: { error: "Upstream AI provider error", detail: err.message || String(err) },
    };
  }

  let usage = extractTokenUsage(service.aiProvider, aiResponse);
  if (!usage) {
    const est = estimateTokensFromOpenAiMessages(aiBody.messages);
    usage = { promptTokens: est, completionTokens: 0, totalTokens: est };
  }

  const actualChargeEth = computeChargeEth(
    usage.totalTokens,
    Number(service.pricePerThousandTokens),
    chargeEth
  );

  try {
    service.totalUses = (service.totalUses || 0) + 1;
    service.totalRevenue = Number(service.totalRevenue || 0) + chargeEth;
    await service.save();

    const logDoc = await ApiUsageLog.create({
      userWallet,
      serviceId: service._id,
      accessTokenId,
      developerWallet: creatorWallet,
      amountEth: chargeEth,
      aiProvider: service.aiProvider,
      modelName: service.modelName,
      paymentTxId: deduct.txHash,
      fheDeductTxHash: deduct.txHash,
      success: true,
      fhePayment: true,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      chargeEth: actualChargeEth,
      pricePerThousandTokens: Number(service.pricePerThousandTokens),
    });

    notifyCreatorPurchaseWebhooks({
      creatorWallet,
      usageLog: logDoc,
      service,
      x402Payment: false,
    });
  } catch (logErr) {
    if (logErr?.code === 11000) {
      return {
        handled: true,
        status: 409,
        body: { error: "This FHE deduction has already been used" },
      };
    }
    console.error("[fhe] usage log error:", logErr);
    return { handled: true, status: 500, body: { error: "Could not finalize usage log" } };
  }

  return {
    handled: true,
    status: 200,
    body: {
      ...aiResponse,
      sentinelReceipt: {
        paymentMethod: "fhe_balance",
        paymentProtocol: "cofhe",
        txHash: deduct.txHash,
        fheDeductTxHash: deduct.txHash,
        explorerUrl: deduct.explorerUrl,
        chargeEth,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        pricePerThousandTokens: Number(service.pricePerThousandTokens),
      },
    },
  };
}

export function buildAiBodyFromRequest(reqBody) {
  const { txId: _t, paymentRef: _p, txHash: _h, prompt, messages, ...rest } = reqBody || {};
  if (Array.isArray(messages) && messages.length > 0) {
    return { messages, ...rest };
  }
  if (typeof prompt === "string" && prompt.trim()) {
    return { messages: [{ role: "user", content: prompt.trim() }], ...rest };
  }
  return null;
}
