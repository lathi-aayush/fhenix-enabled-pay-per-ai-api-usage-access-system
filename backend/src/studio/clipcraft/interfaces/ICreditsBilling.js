// @filename: backend/src/studio/clipcraft/interfaces/ICreditsBilling.js

import { createContract, validateImplementation } from "./createContract.js";

const METHODS = [
  "getBalance",
  "calculateCost",
  "deductAtomic",
  "refund",
  "appendAuditEntry",
];

/**
 * @typedef {Object} DeductResult
 * @property {boolean} ok
 * @property {number} balanceAfter
 * @property {string} transactionId
 * @property {string} [error]
 */

/**
 * @typedef {Object} RefundResult
 * @property {boolean} ok
 * @property {number} balanceAfter
 * @property {string} transactionId
 */

/** @returns {object} */
export function ICreditsBillingContract() {
  return createContract("ICreditsBilling", METHODS);
}

/** @param {object} impl */
export function asCreditsBilling(impl) {
  return validateImplementation(impl, "ICreditsBilling", METHODS);
}

/**
 * @typedef {Object} ICreditsBilling
 * @property {(userId: string) => Promise<import('../contracts/schemas.js').UserCredits>} getBalance
 * @property {(input: { packCount: number, tier: "standard"|"viral" }) => number} calculateCost
 * @property {(input: { userId: string, amount: number, jobId: string, idempotencyKey: string }) => Promise<DeductResult>} deductAtomic
 * @property {(input: { userId: string, amount: number, jobId: string, reason: string }) => Promise<RefundResult>} refund
 * @property {(entry: import('../contracts/schemas.js').CreditTransaction) => Promise<void>} appendAuditEntry
 */

export const ICreditsBillingMethods = METHODS;
