/** Public treasury/receiver wallet address — safe to expose to frontend. */
export function getPublicReceiverWallet() {
  return (
    process.env.TREASURY_WALLET_ADDRESS?.trim() ||
    process.env.RECEIVER_WALLET?.trim() ||
    ""
  );
}
