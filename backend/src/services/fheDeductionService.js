/**
 * CoFHE operator service — encrypts per-call charges and calls SentinelPayment.deductForCall.
 * @see https://cofhe-docs.fhenix.zone/client-sdk/guides/encrypting-inputs.md
 */

import { createCofheClient, createCofheConfig } from "@cofhe/sdk/node";
import { Encryptable } from "@cofhe/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ethers } from "ethers";
import { getContractConfig } from "../config/contractConfig.js";
import { getNetworkConfig } from "../config/chainConfig.js";
import { explorerTxUrl } from "../config/chainConfig.js";
import { isValidEvmAddress, normalizeEvmAddress } from "./evmService.js";

const SENTINEL_ABI = [
  "function deductForCall(address user, tuple(uint256 ctHash, bytes signature) encAmount, address service)",
  "function hasBalance(address user) view returns (bool)",
  "function owner() view returns (address)",
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

    const net = getNetworkConfig();
    const normalizedPk = pk.startsWith("0x") ? pk : `0x${pk}`;
    const account = privateKeyToAccount(normalizedPk);

    const publicClient = createPublicClient({
      chain: net.viemChain,
      transport: http(net.rpcUrl),
    });
    const walletClient = createWalletClient({
      chain: net.viemChain,
      transport: http(net.rpcUrl),
      account,
    });

    const config = createCofheConfig({ supportedChains: [net.cofheChain] });
    const client = createCofheClient(config);
    await client.connect(publicClient, walletClient);

    const provider = new ethers.JsonRpcProvider(net.rpcUrl);
    const signer = new ethers.Wallet(normalizedPk, provider);
    const contract = new ethers.Contract(address, SENTINEL_ABI, signer);

    const owner = await contract.owner();
    if (owner.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error(
        `OPERATOR_PRIVATE_KEY (${account.address}) is not SentinelPayment owner (${owner})`
      );
    }

    return { client, contract, operatorAddress: account.address };
  })().catch((err) => {
    operatorPromise = null;
    throw err;
  });

  return operatorPromise;
}

/** Startup check — logs whether FHE deductions can run. */
export async function getFheStatus() {
  const { address, chainId } = getContractConfig();
  const net = getNetworkConfig(chainId);
  const base = {
    configured: isFheConfigured(),
    contractAddress: address || null,
    chainId,
    network: net.name,
    operatorKeySet: Boolean(getOperatorKey()),
  };
  if (!base.configured) return { ...base, ready: false, reason: "missing_contract_or_operator_key" };

  try {
    const { operatorAddress } = await getOperatorContext();
    return { ...base, ready: true, operatorAddress };
  } catch (e) {
    return { ...base, ready: false, reason: "operator_init_failed", error: e?.message || String(e) };
  }
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
