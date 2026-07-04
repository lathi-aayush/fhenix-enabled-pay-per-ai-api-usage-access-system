/**
 * metamask.js â€” MetaMask wallet integration for SentinelAI on Base Sepolia.
 * Replaces metamask.js (MetaMask / Base Sepolia).
 *
 * Uses window.ethereum directly â€” no external wallet library needed.
 */

const BASE_SEPOLIA_CHAIN_ID = "0x14A34"; // 84532 in hex

let _connectedAddress = null;

/**
 * Normalize an EVM address to lowercase checksummed form.
 */
export function normalizeAddress(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  return s.length === 42 && s.startsWith("0x") ? s.toLowerCase() : null;
}

function getProvider() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not installed. Install it from metamask.io");
  }
  return window.ethereum;
}

/**
 * Switch MetaMask to Base Sepolia network.
 */
async function switchToBaseSepolia() {
  const provider = getProvider();
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_SEPOLIA_CHAIN_ID }],
    });
  } catch (e) {
    if (e.code === 4902) {
      // Chain not added â€” add it
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BASE_SEPOLIA_CHAIN_ID,
            chainName: "Base Sepolia",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://sepolia.base.org"],
            blockExplorerUrls: ["https://sepolia.basescan.org"],
          },
        ],
      });
    } else {
      throw e;
    }
  }
}

/**
 * Connect MetaMask and return the active address.
 * Equivalent of connectMetaMask().
 */
export async function connectMetaMask() {
  const provider = getProvider();
  await switchToBaseSepolia();
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("No accounts returned from MetaMask");
  _connectedAddress = normalizeAddress(accounts[0]);
  return _connectedAddress;
}

/**
 * Silently restore an existing MetaMask connection (no popup).
 * Equivalent of reconnectMetaMask().
 */
export async function reconnectMetaMask() {
  try {
    const provider = getProvider();
    const accounts = await provider.request({ method: "eth_accounts" });
    const first = accounts?.[0] ? normalizeAddress(accounts[0]) : null;
    _connectedAddress = first;
    return first;
  } catch {
    _connectedAddress = null;
    return null;
  }
}

export async function disconnectMetaMask() {
  _connectedAddress = null;
}

export function getConnectedAddress() {
  return _connectedAddress;
}

/**
 * Sign an arbitrary message using MetaMask personal_sign (EIP-191).
 * Used for wallet challenge auth â€” replaces MetaMask signData().
 *
 * Returns the hex signature string (0x...).
 */
export async function signMessage(message, address) {
  const provider = getProvider();
  const signer = normalizeAddress(address) ?? _connectedAddress;
  if (!signer) throw new Error("No signer address. Connect MetaMask first.");
  return provider.request({
    method: "personal_sign",
    params: [message, signer],
  });
}

/**
 * Send a native ETH payment via MetaMask.
 * Equivalent of signAndSendPayment() from metamask.js.
 *
 * @param {object} opts
 * @param {string} opts.from      Sender address
 * @param {string} opts.to        Receiver address
 * @param {string} opts.amountWei Amount in wei (string or BigInt)
 * @returns {Promise<{ txHash: string }>}
 */
export async function sendEthPayment({ from, to, amountWei }) {
  const provider = getProvider();
  await switchToBaseSepolia();

  const sender = normalizeAddress(from) ?? _connectedAddress;
  if (!sender) throw new Error("No sender address. Connect MetaMask first.");

  const txHash = await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: sender,
        to: normalizeAddress(to),
        value: "0x" + BigInt(amountWei).toString(16),
        chainId: BASE_SEPOLIA_CHAIN_ID,
      },
    ],
  });

  return { txHash };
}

/**
 * Get ETH balance for an address (uses MetaMask's connected RPC).
 * @returns {Promise<bigint>} balance in wei
 */
export async function getBalance(address) {
  const provider = getProvider();
  const hex = await provider.request({
    method: "eth_getBalance",
    params: [normalizeAddress(address) ?? address, "latest"],
  });
  return BigInt(hex);
}
