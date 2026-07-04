/**
 * CoFHE client helpers — deposit ETH and decrypt sealed FHE balance.
 * @see https://cofhe-docs.fhenix.zone/client-sdk/guides/client-setup.md
 */

import { createCofheConfig, createCofheClient } from "@cofhe/sdk/web";
import { FheTypes } from "@cofhe/sdk";
import { sepolia as cofheSepolia } from "@cofhe/sdk/chains";
import { Ethers6Adapter } from "@cofhe/sdk/adapters";
import { BrowserProvider, Contract } from "ethers";
import { connectMetaMask } from "./metamask.js";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS?.trim() || "";

const SENTINEL_ABI = [
  "function deposit() payable",
  "function sealedBalance() view returns (bytes32)",
  "function hasBalance(address) view returns (bool)",
];

let cofheClientPromise = null;

export function isCofheContractConfigured() {
  return Boolean(CONTRACT_ADDRESS && CONTRACT_ADDRESS.startsWith("0x"));
}

async function getCofheClient() {
  if (!isCofheContractConfigured()) {
    throw new Error("VITE_CONTRACT_ADDRESS is not set. Deploy SentinelPayment and add it to frontend/.env");
  }

  if (cofheClientPromise) return cofheClientPromise;

  cofheClientPromise = (async () => {
    await connectMetaMask();
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const { publicClient, walletClient } = await Ethers6Adapter(provider, signer);

    const config = createCofheConfig({ supportedChains: [cofheSepolia] });
    const client = createCofheClient(config);
    await client.connect(publicClient, walletClient);
    return client;
  })();

  return cofheClientPromise;
}

function getContract(signer) {
  return new Contract(CONTRACT_ADDRESS, SENTINEL_ABI, signer);
}

/** Deposit native ETH — balance stored as encrypted euint64 on-chain. */
export async function depositToSentinel(amountWei) {
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
  return CONTRACT_ADDRESS;
}
