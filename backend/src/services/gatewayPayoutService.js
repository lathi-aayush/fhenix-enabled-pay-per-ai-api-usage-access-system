/**
 * Gateway payout service stub � Base Sepolia-based payout removed.
 * EVM payout pending.
 */
export async function getDeveloperEarningsSummary(userId) {
  return { totalEarnedCents: 0, totalPaidOutCents: 0, pendingCents: 0 };
}

export async function processPendingPayouts() {
  return { processed: 0 };
}