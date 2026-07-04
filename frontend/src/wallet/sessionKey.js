/**
 * sessionKey.js — Local EVM session key wallet for headless payments.
 * Replaces burner.js (Base Sepolia mnemonic burner wallet).
 *
 * Generates a random EVM private key per user, stores it AES-256-GCM encrypted
 * in localStorage, and syncs it to the backend profile. Used for:
 *   - x402 AI proxy calls (automatic, no MetaMask popup)
 *   - Studio overage micro-payments
 */

import { api } from "../api/client.js";

const SESSION_KEY_PREFIX = "sentinal_session_key:";

let _activeUserId = null;
const _keyCache = new Map(); // userId → { privateKey, address }

// ── Crypto helpers ────────────────────────────────────────────────────────────

function hexToBytes(hex) {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return new Uint8Array(h.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
}

function bytesToHex(bytes) {
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Derive an AES-256-GCM key from the JWT token (used as passphrase).
 * This ties the local encryption to the user's session — not cryptographically
 * strong isolation, but sufficient for testnet session keys.
 */
async function deriveEncKey(passphrase) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("sentinal-fhenix-session"), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptKey(privateKey, passphrase) {
  const key = await deriveEncKey(passphrase);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(privateKey));
  return JSON.stringify({
    iv: bytesToHex(iv),
    ct: bytesToHex(new Uint8Array(ciphertext)),
  });
}

async function decryptKey(encrypted, passphrase) {
  const { iv, ct } = JSON.parse(encrypted);
  const key = await deriveEncKey(passphrase);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hexToBytes(iv) },
    key,
    hexToBytes(ct)
  );
  return new TextDecoder().decode(plain);
}

// ── Address derivation (no external lib — use eth_accounts trick) ─────────────

/**
 * Derive the EVM address from a private key.
 * Uses the backend's /api/profile/session-key/address helper to avoid bundling ethers in this file.
 * Falls back to a stored address if already synced.
 */
async function getAddressForKey(privateKey) {
  try {
    const { data } = await api.post("/api/profile/session-key/address", { privateKey });
    return data.address;
  } catch {
    return null;
  }
}

// ── Storage ───────────────────────────────────────────────────────────────────

function storageKey(userId) {
  return `${SESSION_KEY_PREFIX}${userId}`;
}

function readLocalEncrypted(userId) {
  if (!userId) return null;
  return localStorage.getItem(storageKey(userId)) || null;
}

function writeLocalEncrypted(userId, encrypted) {
  if (!userId || !encrypted) return;
  localStorage.setItem(storageKey(userId), encrypted);
}

function hasAuthToken() {
  return Boolean(api.defaults.headers.common?.Authorization);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize the session key for a logged-in user.
 * Generates a new random private key if none exists, encrypts it, and syncs to backend.
 * Equivalent of ensureBurnerWallet().
 *
 * @param {string} userId   - User's MongoDB _id
 * @param {string} jwtToken - Used as passphrase for local AES encryption
 */
export async function ensureSessionKey(userId, jwtToken) {
  if (!userId) return null;
  if (_keyCache.has(userId)) return readLocalEncrypted(userId);

  _activeUserId = userId;

  // Try to restore from localStorage
  let encrypted = readLocalEncrypted(userId);

  // Try to restore from backend if not local
  if (!encrypted && hasAuthToken()) {
    try {
      const { data } = await api.get("/api/profile/session-key");
      if (data?.encryptedKey) {
        encrypted = data.encryptedKey;
        writeLocalEncrypted(userId, encrypted);
      }
    } catch {
      /* new user — will generate below */
    }
  }

  // Generate a new random private key if none found
  if (!encrypted) {
    const rawBytes = crypto.getRandomValues(new Uint8Array(32));
    const privateKey = "0x" + Array.from(rawBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    encrypted = await encryptKey(privateKey, jwtToken);
    writeLocalEncrypted(userId, encrypted);

    // Sync to backend (non-blocking)
    if (hasAuthToken()) {
      api.post("/api/profile/session-key", { encryptedKey: encrypted }).catch(() => {});
    }
  }

  // Decrypt and cache
  try {
    const privateKey = await decryptKey(encrypted, jwtToken);
    const address = await getAddressForKey(privateKey);
    if (privateKey && address) {
      _keyCache.set(userId, { privateKey, address });
    }
  } catch {
    /* decryption will succeed once user has JWT */
  }

  return encrypted;
}

/**
 * Get the session key wallet for the active user.
 * Returns { privateKey, address } or throws.
 */
export function getSessionKeyWallet(userId = _activeUserId) {
  const uid = userId || _activeUserId;
  if (!uid) throw new Error("Session key not ready — sign in first");
  const cached = _keyCache.get(uid);
  if (cached) return cached;
  throw new Error("Session key not initialized. Refresh the page after signing in.");
}

export function getSessionKeyAddress(userId = _activeUserId) {
  return getSessionKeyWallet(userId).address;
}

export function clearActiveSessionUser() {
  _activeUserId = null;
  _keyCache.clear();
}

/**
 * Get the session key ETH balance (in wei, as BigInt) using MetaMask's RPC.
 */
export async function getSessionBalance(userId = _activeUserId) {
  const { address } = getSessionKeyWallet(userId);
  if (typeof window === "undefined" || !window.ethereum) return 0n;
  try {
    const hex = await window.ethereum.request({
      method: "eth_getBalance",
      params: [address, "latest"],
    });
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

/**
 * Send ETH from the session key wallet to a destination.
 * Equivalent of sendBurnerPayment().
 */
export async function sendSessionPayment({ to, amountWei }) {
  const { privateKey } = getSessionKeyWallet();

  // Use the backend as a signing relay to avoid bundling ethers for signing
  const { data } = await api.post("/api/profile/session-key/send", {
    privateKey,
    to,
    amountWei: amountWei.toString(),
  });
  return { txHash: data.txHash };
}
