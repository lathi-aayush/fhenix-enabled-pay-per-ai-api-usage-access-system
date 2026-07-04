/**
 * evmService.js — EVM/Sepolia equivalent of evmService.js
 *
 * Provides RPC interaction, tx receipt polling, address normalization,
 * and balance queries for Sepolia (chainId 11155111).
 */

import { ethers } from "ethers";

let _provider = null;

function getRpcUrl() {
  return (
    process.env.RPC_URL?.trim() ||
    "https://ethereum-sepolia-rpc.publicnode.com"
  );
}

export function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(getRpcUrl());
  }
  return _provider;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Normalize an EVM address to checksummed form.
 * Returns the input unchanged if not a valid address.
 */
export function normalizeEvmAddress(addr) {
  if (!addr || typeof addr !== "string") return addr;
  try {
    return ethers.getAddress(addr.trim());
  } catch {
    return addr.trim();
  }
}

/**
 * Returns true if addr is a valid EVM address.
 */
export function isValidEvmAddress(addr) {
  if (!addr || typeof addr !== "string") return false;
  try {
    ethers.getAddress(addr.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * Compare two EVM addresses (checksummed, case-insensitive).
 */
export function sameEvmAddress(a, b) {
  try {
    return ethers.getAddress(String(a ?? "").trim()) === ethers.getAddress(String(b ?? "").trim());
  } catch {
    return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
  }
}

/**
 * Poll for a confirmed transaction receipt with retries.
 * Equivalent of lookupTransactionByIDWithRetry from evmService.
 */
export async function getReceiptWithRetry(txHash, { tries = 12, delayMs = 2000 } = {}) {
  const provider = getProvider();
  const hash = String(txHash || "").trim();
  if (!hash) throw new Error("Missing transaction hash");

  for (let i = 0; i < tries; i++) {
    try {
      const receipt = await provider.getTransactionReceipt(hash);
      if (receipt) return receipt;
    } catch (e) {
      if (i === tries - 1) throw e;
    }
    if (i < tries - 1) await sleep(delayMs);
  }
  throw new Error(
    `Transaction ${hash} not visible on Sepolia after ${tries} attempts. ` +
    "The network may be lagging — wait a moment and try again."
  );
}

/**
 * Get the full transaction object (includes value, to, from).
 */
export async function getTransaction(txHash) {
  const provider = getProvider();
  const hash = String(txHash || "").trim();
  if (!hash) throw new Error("Missing transaction hash");
  return provider.getTransaction(hash);
}

/**
 * Parse a native ETH transfer from a transaction.
 * Returns { sender, receiver, amountWei } or null if not a value transfer.
 */
export async function parseEthTransferFromTx(txHash) {
  const tx = await getTransaction(txHash);
  if (!tx) return null;
  if (tx.value === 0n) return null;
  return {
    sender: normalizeEvmAddress(tx.from),
    receiver: normalizeEvmAddress(tx.to),
    amountWei: tx.value,
    amountEth: parseFloat(ethers.formatEther(tx.value)),
  };
}

/**
 * Get native ETH balance for an address in wei.
 */
export async function getBalanceWei(address) {
  const provider = getProvider();
  return provider.getBalance(normalizeEvmAddress(address));
}

/**
 * Get native ETH balance in ETH (float).
 */
export async function getBalanceEth(address) {
  const balWei = await getBalanceWei(address);
  return parseFloat(ethers.formatEther(balWei));
}

/**
 * Convert ETH string/number to wei (BigInt).
 */
export function ethToWei(eth) {
  return ethers.parseEther(String(eth));
}

/**
 * Convert wei (BigInt or string) to ETH float.
 */
export function weiToEth(wei) {
  return parseFloat(ethers.formatEther(BigInt(wei)));
}

/**
 * Check if a paid wei amount is within tolerance of expected wei.
 * Equivalent of amountWeisWithinTolerance from billing.js.
 */
export function weiWithinTolerance(paidWei, expectedWei, tolerancePercent = 1) {
  const paid = BigInt(paidWei);
  const expected = BigInt(expectedWei);
  if (paid === expected) return true;
  const slack = (expected * BigInt(Math.round(tolerancePercent * 100))) / 10000n;
  const minAccepted = expected - (slack > 0n ? slack : 1n);
  return paid >= minAccepted;
}

/**
 * Etherscan transaction URL for Sepolia.
 */
export function explorerTxUrl(txHash) {
  if (!txHash) return null;
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

export function explorerAddressUrl(address) {
  if (!address) return null;
  return `https://sepolia.etherscan.io/address/${address}`;
}

export function explorerTokenUrl(address) {
  if (!address) return null;
  return `https://sepolia.etherscan.io/token/${address}`;
}
