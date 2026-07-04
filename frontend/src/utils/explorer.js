/**
 * Etherscan explorer URLs for Sepolia.
 * Replaces explorer.js (Sepolia).
 */

const ETHERSCAN_BASE = "https://sepolia.etherscan.io";

/** Link to a transaction on Sepolia Etherscan. */
export function getTxUrl(txHash) {
  if (!txHash) return null;
  return `${ETHERSCAN_BASE}/tx/${txHash}`;
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
  return `${ETHERSCAN_BASE}/address/${address}`;
}

export function explorerAddressUrl(address) {
  return getAddressUrl(address);
}

export function getTokenUrl(tokenAddress) {
  if (!tokenAddress) return null;
  return `${ETHERSCAN_BASE}/token/${tokenAddress}`;
}

export function explorerTokenUrl(address) {
  return getTokenUrl(address);
}
