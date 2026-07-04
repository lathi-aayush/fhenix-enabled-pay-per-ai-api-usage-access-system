/**
 * CoFHE client helpers — deposit ETH and decrypt sealed FHE balance.
 * @see https://cofhe-docs.fhenix.zone/client-sdk/guides/client-setup.md
 */

import { createCofheConfig, createCofheClient } from "@cofhe/sdk/web";
import { FheTypes } from "@cofhe/sdk";
import { baseSepolia as cofheBaseSepolia, sepolia as cofheSepolia } from "@cofhe/sdk/chains";
import { Ethers6Adapter } from "@cofhe/sdk/adapters";
import { BrowserProvider, Contract } from "ethers";
import { connectMetaMask } from "./metamask.js";
import { getChainId } from "../config/chain.js";
import { api } from "../api/client.js";

const ENV_CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS?.trim() || "";

const SENTINEL_ABI = [
  "function deposit() payable",
  "function sealedBalance() view returns (bytes32)",
  "function hasBalance(address) view returns (bool)",
];

let cofheClientPromise = null;
let resolvedContractAddress = ENV_CONTRACT_ADDRESS;

function getCofheChain() {
  const chainId = getChainId();
  return chainId === 11155111 ? cofheSepolia : cofheBaseSepolia;
}

export function isCofheContractConfigured() {
  return Boolean(resolvedContractAddress && resolvedContractAddress.startsWith("0x"));
}

/** Resolve contract address from env or backend stats API. */
export async function resolveContractAddress() {
  if (ENV_CONTRACT_ADDRESS?.startsWith("0x")) {
    resolvedContractAddress = ENV_CONTRACT_ADDRESS;
    return resolvedContractAddress;
  }
  try {
    const { data } = await api.get("/api/contract/stats");
    if (data?.contractAddress?.startsWith("0x")) {
      resolvedContractAddress = data.contractAddress;
      return resolvedContractAddress;
    }
  } catch {
    // ponytail: stats fetch is best-effort; env is primary
  }
  return resolvedContractAddress;
}

async function getCofheClient() {
  await resolveContractAddress();
  if (!isCofheContractConfigured()) {
    throw new Error(
      "Contract address not configured. Deploy SentinelPayment and set VITE_CONTRACT_ADDRESS or CONTRACT_ADDRESS in backend."
    );
  }

  if (cofheClientPromise) return cofheClientPromise;

  cofheClientPromise = (async () => {
    await connectMetaMask();
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const { publicClient, walletClient } = await Ethers6Adapter(provider, signer);

    const config = createCofheConfig({ supportedChains: [getCofheChain()] });
    const client = createCofheClient(config);
    await client.connect(publicClient, walletClient);
    return client;
  })().catch((err) => {
    cofheClientPromise = null;
    throw err;
  });

  return cofheClientPromise;
}

function getContract(signerOrProvider) {
  return new Contract(resolvedContractAddress, SENTINEL_ABI, signerOrProvider);
}

/** Deposit native ETH — balance stored as encrypted euint64 on-chain. */
export async function depositToSentinel(amountWei) {
  await resolveContractAddress();
  if (!isCofheContractConfigured()) {
    throw new Error("Contract address not configured");
  }
  await connectMetaMask();
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = getContract(signer);
  const tx = await contract.deposit({ value: BigInt(amountWei) });
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

/** Plaintext bool — safe to read without permit. */
export async function checkHasFheBalance(userAddress) {
  await resolveContractAddress();
  if (!isCofheContractConfigured() || !userAddress) return false;
  const provider = new BrowserProvider(window.ethereum);
  const contract = getContract(provider);
  return contract.hasBalance(userAddress);
}

/** Unseal encrypted balance for the connected wallet (requires permit). */
export async function getDecryptedBalanceWei() {
  const client = await getCofheClient();
  await client.permits.getOrCreateSelfPermit();

  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = getContract(signer);

  const ctHash = await contract.sealedBalance();
  const balance = await client.decryptForView(ctHash, FheTypes.Uint64).execute();
  return BigInt(balance);
}

export function getContractAddress() {
  return resolvedContractAddress;
}

export async function getFheWalletStatus() {
  try {
    const { data } = await api.get("/api/contract/stats");
    return data?.fhe ?? null;
  } catch {
    return null;
  }
}
