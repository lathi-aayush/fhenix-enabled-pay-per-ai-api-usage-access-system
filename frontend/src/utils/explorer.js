/**
 * BaseScan explorer URLs for Base Sepolia.
 * Replaces explorer.js (Lora / Base Sepolia).
 */

const BASESCAN_BASE = "https://sepolia.basescan.org";

/** Link to a transaction on Base Sepolia BaseScan. */
export function getTxUrl(txHash) {
  if (!txHash) return null;
  return `${BASESCAN_BASE}/tx/${txHash}`;
}

/** @deprecated use getTxUrl */
export function testnetTxUrl(txHash) {
  return getTxUrl(txHash);
}

export function explorerTxUrl(txHash) {
  return getTxUrl(txHash);
}

export function getAddressUrl(address) {
  if (!address) return null;
  return `${BASESCAN_BASE}/address/${address}`;
}

export function explorerAddressUrl(address) {
  return getAddressUrl(address);
}

export function getTokenUrl(tokenAddress) {
  if (!tokenAddress) return null;
  return `${BASESCAN_BASE}/token/${tokenAddress}`;
}

export function explorerTokenUrl(address) {
  return getTokenUrl(address);
}
