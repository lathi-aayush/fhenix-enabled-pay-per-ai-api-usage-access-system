/** 
 * Creator withdrawal service � EVM implementation pending.
 * Stub to prevent import errors after Base Sepolia removal.
 */
export const MIN_WITHDRAWAL_ETH = 0.001;

export async function computeCreatorWithdrawalBalances(userId) {
  return { totalEarned: 0, totalWithdrawn: 0, available: 0 };
}

export async function listCreatorWithdrawals(userId) {
  return [];
}

export async function requestCreatorWithdrawal(userId, amountEth) {
  throw new Error("Creator withdrawals not yet implemented on EVM. Coming soon.");
}