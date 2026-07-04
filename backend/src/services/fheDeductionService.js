/**
 * CoFHE operator service — encrypts per-call charges and calls SentinelPayment.deductForCall.
 * @see https://cofhe-docs.fhenix.zone/client-sdk/guides/encrypting-inputs.md
 */

import { createCofheClient, createCofheConfig } from "@cofhe/sdk/node";
import { Encryptable } from "@cofhe/sdk";
import { sepolia as cofheSepolia } from "@cofhe/sdk/chains";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia as viemSepolia } from "viem/chains";
import { ethers } from "ethers";
import { getContractConfig } from "../config/contractConfig.js";
import { explorerTxUrl, isValidEvmAddress, normalizeEvmAddress } from "./evmService.js";

const SENTINEL_ABI = [
  "function deductForCall(address user, tuple(uint256 ctHash, bytes signature) encAmount, address service)",
  "function hasBalance(address user) view returns (bool)",
];

let operatorPromise = null;

function getOperatorKey() {
  const raw = process.env.OPERATOR_PRIVATE_KEY || process.env.TREASURY_PRIVATE_KEY || "";
  return raw.trim();
}

export function isFheConfigured() {
  const { address } = getContractConfig();
  return Boolean(address && isValidEvmAddress(address) && getOperatorKey());
}

async function getOperatorContext() {
  if (operatorPromise) return operatorPromise;

  operatorPromise = (async () => {
    const pk = getOperatorKey();
    if (!pk) throw new Error("OPERATOR_PRIVATE_KEY or TREASURY_PRIVATE_KEY required");

    const { address } = getContractConfig();
    if (!address || !isValidEvmAddress(address)) {
      throw new Error("CONTRACT_ADDRESS not configured");
    }

    const rpc = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
    const normalizedPk = pk.startsWith("0x") ? pk : `0x${pk}`;
    const account = privateKeyToAccount(normalizedPk);

    const publicClient = createPublicClient({
      chain: viemSepolia,
      transport: http(rpc),
    });
    const walletClient = createWalletClient({
      chain: viemSepolia,
      transport: http(rpc),
      account,
    });

    const config = createCofheConfig({ supportedChains: [cofheSepolia] });
    const client = createCofheClient(config);
    await client.connect(publicClient, walletClient);

    const provider = new ethers.JsonRpcProvider(rpc);
    const signer = new ethers.Wallet(normalizedPk, provider);
    const contract = new ethers.Contract(address, SENTINEL_ABI, signer);

    return { client, contract };
  })();

  return operatorPromise;
}

export async function hasFheBalance(userWallet) {
  if (!isFheConfigured()) return false;
  try {
    const { contract } = await getOperatorContext();
    const addr = normalizeEvmAddress(userWallet);
    if (!addr) return false;
    return Boolean(await contract.hasBalance(addr));
  } catch (e) {
    console.warn("[fhe] hasBalance:", e?.message || e);
    return false;
  }
}

/**
 * Deduct encrypted wei from a user's FHE balance.
 * @returns {{ ok: true, txHash: string, explorerUrl: string } | { ok: false, reason: string, error?: string }}
 */
export async function deductFheBalance({ userWallet, amountWei, serviceWallet }) {
  if (!isFheConfigured()) {
    return { ok: false, reason: "not_configured" };
  }

  const user = normalizeEvmAddress(userWallet);
  const service = normalizeEvmAddress(serviceWallet);
  if (!user || !service) {
    return { ok: false, reason: "invalid_address" };
  }

  try {
    const { client, contract } = await getOperatorContext();

    const has = await contract.hasBalance(user);
    if (!has) return { ok: false, reason: "no_balance" };

    const wei = typeof amountWei === "bigint" ? amountWei : BigInt(amountWei);
    if (wei <= 0n) return { ok: false, reason: "invalid_amount" };

    const [encAmount] = await client.encryptInputs([Encryptable.uint64(wei)]).execute();
    const tx = await contract.deductForCall(user, encAmount, service);
    const receipt = await tx.wait();

    return {
      ok: true,
      txHash: receipt.hash,
      explorerUrl: explorerTxUrl(receipt.hash),
    };
  } catch (e) {
    console.error("[fhe] deductFheBalance:", e?.message || e);
    return { ok: false, reason: "deduct_failed", error: e?.message || String(e) };
  }
}
