import algosdk from "algosdk";
import { normalizeAlgoAddress } from "../services/algorandService.js";
import { AccessToken } from "../models/AccessToken.js";
import { Transaction } from "../models/Transaction.js";
import { ApiUsageLog } from "../models/ApiUsageLog.js";

/**
 * Single canonical form for all Algorand addresses stored on users, balances, and tokens.
 */
export function canonicalWalletAddress(raw) {
  const s = String(raw ?? "").trim();
  if (!s) {
    throw new Error("Wallet address required");
  }
  if (!algosdk.isValidAddress(s)) {
    throw new Error("Invalid Algorand address");
  }
  return normalizeAlgoAddress(s);
}

/**
 * Point all ledger rows that used a raw client-submitted address at the canonical key.
 */
export async function migrateWalletAliasesToCanonical(canonical, rawSubmitted) {
  const raw = String(rawSubmitted ?? "").trim();
  if (!raw || raw === canonical) return;
  await AccessToken.updateMany({ userWallet: raw }, { $set: { userWallet: canonical } });
  await Transaction.updateMany({ userWallet: raw }, { $set: { userWallet: canonical } });
  await ApiUsageLog.updateMany({ userWallet: raw }, { $set: { userWallet: canonical } });
}

/** Compare two wallet strings (canonical form when valid Algorand addresses). */
export function sameWallet(a, b) {
  try {
    return canonicalWalletAddress(a) === canonicalWalletAddress(b);
  } catch {
    return String(a ?? "").trim() === String(b ?? "").trim();
  }
}

/** Mongo filter: services owned by this JWT wallet (canonical + legacy raw). */
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
