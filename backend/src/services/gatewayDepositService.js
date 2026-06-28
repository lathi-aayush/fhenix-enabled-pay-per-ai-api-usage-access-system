/**
 * Gateway deposit service stub — Algorand deposit flow removed.
 * EVM deposit via SentinelPayment contract instead.
 */
export async function pollRecentVaultDeposits() {
  return { processed: 0, skipped: 0 };
}

export async function handleDepositForSubscription(txHash, userId) {
  return null;
}