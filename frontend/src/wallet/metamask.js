/**
 * metamask.js — MetaMask wallet integration for SentinelAI (Base Sepolia / Sepolia).
 */

import { getNetworkConfig } from "../config/chain.js";

let _connectedAddress = null;

export function isMetaMaskInstalled() {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

export function normalizeAddress(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  return s.length === 42 && s.startsWith("0x") ? s.toLowerCase() : null;
}

function getProvider() {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed. Install it from metamask.io");
  }
  return window.ethereum;
}

async function switchToConfiguredNetwork() {
  const provider = getProvider();
  const net = getNetworkConfig();
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: net.chainIdHex }],
    });
  } catch (e) {
    if (e.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [net.metamask],
      });
    } else {
      throw e;
    }
  }
}

export async function ensureSepoliaNetwork() {
  await switchToConfiguredNetwork();
}

export async function connectMetaMask() {
  const provider = getProvider();
  await switchToConfiguredNetwork();
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("No accounts returned from MetaMask");
  _connectedAddress = normalizeAddress(accounts[0]);
  return _connectedAddress;
}

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

export async function signMessage(message, address) {
  const provider = getProvider();
  const signer = normalizeAddress(address) ?? _connectedAddress;
  if (!signer) throw new Error("No signer address. Connect MetaMask first.");
  return provider.request({
    method: "personal_sign",
    params: [message, signer],
  });
}

export async function sendEthPayment({ from, to, amountWei }) {
  const provider = getProvider();
  const net = getNetworkConfig();
  await switchToConfiguredNetwork();

  const sender = normalizeAddress(from) ?? _connectedAddress;
  if (!sender) throw new Error("No sender address. Connect MetaMask first.");

  const txHash = await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: sender,
        to: normalizeAddress(to),
        value: "0x" + BigInt(amountWei).toString(16),
        chainId: net.chainIdHex,
      },
    ],
  });

  return { txHash };
}

export async function getBalance(address) {
  const provider = getProvider();
  const hex = await provider.request({
    method: "eth_getBalance",
    params: [normalizeAddress(address) ?? address, "latest"],
  });
  return BigInt(hex);
}
