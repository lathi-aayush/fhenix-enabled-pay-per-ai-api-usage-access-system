import { ethers } from "ethers";
import { AccessToken } from "../models/AccessToken.js";
import { Transaction } from "../models/Transaction.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";

/**
 * Normalize an EVM address to checksummed form.
 */
export function normalizeEvmAddress(addr) {
  const s = String(addr ?? "").trim();
  if (!s) return s;
  try {
    return ethers.getAddress(s);
  } catch {
    return s;
  }
}

/**
 * Canonical checksummed EVM address — throws on invalid input.
 * Drop-in replacement for canonicalWalletAddress (Base Sepolia version).
 */
export function canonicalWalletAddress(raw) {
  const s = String(raw ?? "").trim();
  if (!s) throw new Error("Wallet address required");
  try {
    return ethers.getAddress(s);
  } catch {
    throw new Error(`Invalid EVM address: ${s}`);
  }
}

/**
 * Migrate ledger rows from a raw address to its canonical checksummed form.
 */
export async function migrateWalletAliasesToCanonical(canonical, rawSubmitted) {
  const raw = String(rawSubmitted ?? "").trim();
  if (!raw || raw === canonical) return;
  await AccessToken.updateMany({ userWallet: raw }, { $set: { userWallet: canonical } });
  await Transaction.updateMany({ userWallet: raw }, { $set: { userWallet: canonical } });
  await ApiUsageLog.updateMany({ userWallet: raw }, { $set: { userWallet: canonical } });
}

/**
 * Compare two EVM wallet addresses (checksummed, case-insensitive).
 */
export function sameWallet(a, b) {
  try {
    return canonicalWalletAddress(a) === canonicalWalletAddress(b);
  } catch {
    return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
  }
}

/**
 * Mongo filter for services owned by a given wallet (canonical + lowercase fallback).
 */
export function creatorServicesOwnedBy(walletFromJwt) {
  let canonical;
  try {
    canonical = canonicalWalletAddress(walletFromJwt);
  } catch {
    return { creatorWallet: String(walletFromJwt || "").trim() };
  }
  const raw = String(walletFromJwt || "").trim();
  if (!raw || raw === canonical) {
    return { creatorWallet: canonical };
  }
  return { $or: [{ creatorWallet: canonical }, { creatorWallet: raw }] };
}
