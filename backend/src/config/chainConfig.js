/**
 * Chain presets for CoFHE-enabled networks (Ethereum Sepolia).
 */
import { baseSepolia as cofheBaseSepolia, sepolia as cofheSepolia } from "@cofhe/sdk/chains";
import { baseSepolia as viemBaseSepolia, sepolia as viemSepolia } from "viem/chains";
import { getContractConfig } from "./contractConfig.js";

const PRESETS = {
  84532: {
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    explorerBase: "https://sepolia.basescan.org",
    cofheChain: cofheBaseSepolia,
    viemChain: viemBaseSepolia,
    metamask: {
      chainIdHex: "0x14a34",
      chainName: "Base Sepolia",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://sepolia.base.org"],
      blockExplorerUrls: ["https://sepolia.basescan.org"],
    },
  },
  11155111: {
    name: "Sepolia",
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    explorerBase: "https://sepolia.etherscan.io",
    cofheChain: cofheSepolia,
    viemChain: viemSepolia,
    metamask: {
      chainIdHex: "0xaa36a7",
      chainName: "Sepolia",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
      blockExplorerUrls: ["https://sepolia.etherscan.io"],
    },
  },
};

export function getActiveChainId() {
  const fromContract = getContractConfig().chainId;
  if (fromContract) return fromContract;
  const fromEnv = Number(process.env.CHAIN_ID);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return 11155111;
}

export function getNetworkConfig(chainId = getActiveChainId()) {
  const preset = PRESETS[chainId] || PRESETS[11155111];
  const rpcUrl = process.env.RPC_URL?.trim() || preset.rpcUrl;
  return {
    chainId,
    name: preset.name,
    rpcUrl,
    explorerBase: preset.explorerBase,
    cofheChain: preset.cofheChain,
    viemChain: preset.viemChain,
    metamask: preset.metamask,
    x402Network: `eip155:${chainId}`,
  };
}

export function explorerTxUrl(txHash, chainId = getActiveChainId()) {
  if (!txHash) return null;
  return `${getNetworkConfig(chainId).explorerBase}/tx/${txHash}`;
}

export function explorerAddressUrl(address, chainId = getActiveChainId()) {
  if (!address) return null;
  return `${getNetworkConfig(chainId).explorerBase}/address/${address}`;
}
