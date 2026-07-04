/**
 * Frontend chain config — must match backend CHAIN_ID / deployed contract.
 */

const PRESETS = {
  84532: {
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    explorerBase: "https://sepolia.basescan.org",
    chainIdHex: "0x14a34",
    metamask: {
      chainId: "0x14a34",
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
    chainIdHex: "0xaa36a7",
    metamask: {
      chainId: "0xaa36a7",
      chainName: "Sepolia",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
      blockExplorerUrls: ["https://sepolia.etherscan.io"],
    },
  },
};

export function getChainId() {
  const fromEnv = Number(import.meta.env.VITE_CHAIN_ID);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return 11155111;
}

export function getNetworkConfig(chainId = getChainId()) {
  const preset = PRESETS[chainId] || PRESETS[11155111];
  const rpcUrl = import.meta.env.VITE_RPC_URL?.trim() || preset.rpcUrl;
  return {
    chainId,
    name: preset.name,
    rpcUrl,
    explorerBase: preset.explorerBase,
    chainIdHex: preset.chainIdHex,
    metamask: preset.metamask,
    x402Network: `eip155:${chainId}`,
  };
}

export function getCofheChainId() {
  return getChainId();
}
