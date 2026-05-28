// @filename: backend/src/studio/clipcraft/services/CreditsBillingEngine.js

import { asCreditsBilling } from "../interfaces/ICreditsBilling.js";
import { calculateClipJobCredits, PricingDefaults } from "../contracts/pricing.js";
import crypto from "crypto";

/** @type {Map<string, { balance: number, transactions: object[] }>} */
const ledger = new Map();
/** @type {Map<string, string>} idempotencyKey -> transactionId */
const idempotencyIndex = new Map();

function newTxId() {
  return `ctx-${crypto.randomBytes(8).toString("hex")}`;
}

function getOrCreateUser(userId, initialBalance = 100) {
  if (!ledger.has(userId)) {
    ledger.set(userId, { balance: initialBalance, transactions: [] });
  }
  return ledger.get(userId);
}

/**
 * @param {import('../config/schema.js').ClipCraftConfig} [config]
 * @param {{ defaultBalance?: number }} [opts]
 */
export function createCreditsBillingEngine(config, opts = {}) {
  const rates = {
    CREDITS_PER_PACK: config?.creditsPerPack ?? PricingDefaults.CREDITS_PER_PACK,
    BULK_PACK_THRESHOLD: config?.bulkPackThreshold ?? PricingDefaults.BULK_PACK_THRESHOLD,
    BULK_PACK_TOTAL_CREDITS: config?.bulkPackTotalCredits ?? PricingDefaults.BULK_PACK_TOTAL_CREDITS,
    VIRAL_SURCHARGE_PER_PACK: config?.viralSurchargePerPack ?? PricingDefaults.VIRAL_SURCHARGE_PER_PACK,
  };
  const defaultBalance = opts.defaultBalance ?? 100;

  return asCreditsBilling({
    async getBalance(userId) {
      const u = getOrCreateUser(userId, defaultBalance);
      return {
        userId,
        balance: u.balance,
        transactions: [...u.transactions],
      };
    },

    calculateCost({ packCount, tier }) {
      return calculateClipJobCredits(packCount, tier, rates);
    },

    async deductAtomic({ userId, amount, jobId, idempotencyKey }) {
      const key = `${userId}:${idempotencyKey}`;
      if (idempotencyIndex.has(key)) {
        const txId = idempotencyIndex.get(key);
        const u = getOrCreateUser(userId, defaultBalance);
        const existing = u.transactions.find((t) => t.id === txId);
        return {
          ok: true,
          balanceAfter: u.balance,
          transactionId: txId,
        };
      }

      const u = getOrCreateUser(userId, defaultBalance);
      if (u.balance < amount) {
        return { ok: false, balanceAfter: u.balance, transactionId: "", error: "Insufficient credits" };
      }

      const tx = {
        id: newTxId(),
        amount: -amount,
        type: "deduct",
        jobId,
        createdAt: new Date().toISOString(),
        status: "committed",
      };
      u.balance = Math.round((u.balance - amount) * 1000) / 1000;
      u.transactions.push(Object.freeze({ ...tx }));
      idempotencyIndex.set(key, tx.id);
      return { ok: true, balanceAfter: u.balance, transactionId: tx.id };
    },

    async refund({ userId, amount, jobId, reason }) {
      const u = getOrCreateUser(userId, defaultBalance);
      const tx = {
        id: newTxId(),
        amount,
        type: "refund",
        jobId,
        createdAt: new Date().toISOString(),
        status: "committed",
        reason,
      };
      u.balance = Math.round((u.balance + amount) * 1000) / 1000;
      u.transactions.push(Object.freeze({ ...tx }));
      return { ok: true, balanceAfter: u.balance, transactionId: tx.id };
    },

    async appendAuditEntry(entry) {
      const uid = entry.userId ?? "system";
      const u = getOrCreateUser(uid, defaultBalance);
      u.transactions.push(Object.freeze({ ...entry, userId: uid }));
    },
  });
}

export function resetCreditsLedger() {
  ledger.clear();
  idempotencyIndex.clear();
}

export function seedUserCredits(userId, balance) {
  ledger.set(userId, { balance, transactions: [] });
}
