/**
 * Explorer URLs — driven by VITE_CHAIN_ID (Base Sepolia or Sepolia).
 */

import { getNetworkConfig } from "../config/chain.js";

export function getTxUrl(txHash) {
  if (!txHash) return null;
  return `${getNetworkConfig().explorerBase}/tx/${txHash}`;
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
  return `${getNetworkConfig().explorerBase}/address/${address}`;
}

export function explorerAddressUrl(address) {
  return getAddressUrl(address);
}

export function getTokenUrl(tokenAddress) {
  if (!tokenAddress) return null;
  return `${getNetworkConfig().explorerBase}/token/${tokenAddress}`;
}

export function explorerTokenUrl(address) {
  return getTokenUrl(address);
}
