// Pera may return accounts as plain strings OR { address: "..." } depending on version / web.
// AlgSDK requires real Algorand address strings — otherwise you get "Address must not be null or undefined".
import { PeraWalletConnect } from "@perawallet/connect";

const peraWallet = new PeraWalletConnect({ chainId: 416002 });
let _connectedAddress = null;

export function normalizeAccountAddress(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    return s.length ? s : null;
  }
  if (typeof raw === "object" && raw !== null) {
    const a = raw.address ?? raw.addr ?? raw.publicAddress;
    if (typeof a === "string" && a.trim().length) return a.trim();
  }
  return null;
}

export async function reconnectPera() {
  try {
    const accounts = await peraWallet.reconnectSession();
    const first = Array.isArray(accounts) ? accounts[0] : null;
    _connectedAddress = normalizeAccountAddress(first);
    return _connectedAddress;
  } catch {
    _connectedAddress = null;
    return null;
  }
}

export async function connectPera() {
  try {
    const accounts = await peraWallet.connect();
    if (!accounts?.length) throw new Error("No accounts returned from Pera.");
    const addr = normalizeAccountAddress(accounts[0]);
    if (!addr) throw new Error("Could not read wallet address from Pera.");
    _connectedAddress = addr;
    return _connectedAddress;
  } catch (e) {
    if (
      e?.message?.includes("Session currently connected") || 
      e?.name === "PeraWalletConnectError" ||
      e?.message?.includes("already connected")
    ) {
      console.log("[Pera Connect] Catching active session, attempting reconnection...");
      try {
        const accounts = await peraWallet.reconnectSession();
        if (accounts && accounts.length > 0) {
          const addr = normalizeAccountAddress(accounts[0]);
          if (addr) {
            _connectedAddress = addr;
            return _connectedAddress;
          }
        }
      } catch (reconErr) {
        console.warn("[Pera Connect] Reconnection failed, forcing reset...", reconErr);
      }
      
      // Force disconnect and retry fresh connection
      await disconnectPera();
      const retryAccounts = await peraWallet.connect();
      if (!retryAccounts?.length) throw new Error("No accounts returned from Pera.");
      const addr = normalizeAccountAddress(retryAccounts[0]);
      _connectedAddress = addr;
      return _connectedAddress;
    }
    throw e;
  }
}

/** Compare two Algorand addresses (handles casing / encoding differences). */
export async function addressesEqual(a, b) {
  const A = normalizeAccountAddress(a);
  const B = normalizeAccountAddress(b);
  if (!A || !B) return false;
  const algosdk = (await import("algosdk")).default;
  try {
    return (
      algosdk.encodeAddress(algosdk.decodeAddress(A)) ===
      algosdk.encodeAddress(algosdk.decodeAddress(B))
    );
  } catch {
    return A === B;
  }
}

export async function disconnectPera() {
  try {
    await peraWallet.disconnect();
  } catch {
    /* ignore */
  } finally {
    _connectedAddress = null;
  }
}

export async function signAndSendPayment({
  from,
  to,
  amountMicroAlgos,
  noteStr,
  algodServer,
  confirmRounds = 100,
}) {
  const algosdk = (await import("algosdk")).default;

  if (!peraWallet.isConnected) {
    console.log("[Pera signAndSendPayment] Not connected. Attempting reconnection...");
    try {
      await reconnectPera();
    } catch (err) {
      console.warn("Auto-reconnect failed:", err);
    }
  }

  if (!peraWallet.isConnected) {
    throw new Error("Pera Wallet is not connected. Please connect your wallet in the navigation bar.");
  }

  const signer =
    normalizeAccountAddress(from) ?? normalizeAccountAddress(_connectedAddress);
  const toAddr = normalizeAccountAddress(to);
  const amt = Number(amountMicroAlgos);

  if (!signer) {
    throw new Error("No sender address. Connect Pera Wallet first.");
  }
  if (!toAddr) {
    throw new Error("Receiver address missing — check service payout wallet on the server.");
  }
  if (!algosdk.isValidAddress(signer)) {
    throw new Error("Sender is not a valid Algorand address.");
  }
  if (!algosdk.isValidAddress(toAddr)) {
    throw new Error("Receiver is not a valid Algorand address.");
  }
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new Error("Invalid payment amount.");
  }
  if (!algodServer || typeof algodServer !== "string" || !algodServer.trim()) {
    throw new Error("Algod URL missing.");
  }

  const algod = new algosdk.Algodv2("", algodServer.trim(), "");
  const suggestedParams = await algod.getTransactionParams().do();
  const note = noteStr ? new TextEncoder().encode(noteStr) : undefined;

  // algosdk v3+ uses `sender` / `receiver` (not `from` / `to`). Wrong keys = undefined addresses.
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: signer,
    receiver: toAddr,
    amount: Math.round(amt),
    note,
    suggestedParams,
  });

  // Do not pass signer as 2nd arg: Pera's composeTransaction sets signers=[] when
  // signerAddress is set but txn.signers doesn't include it — with no txn.signers that
  // skips signing and causes "Group transaction does not need to be signed by Wallet user".
  const signedTxns = await peraWallet.signTransaction([[{ txn }]]);
  const submitted = await algod.sendRawTransaction(signedTxns[0]).do();
  const txid = submitted?.txid ?? submitted?.txId;
  if (!txid) {
    throw new Error("Network did not return a transaction id after submit.");
  }
  const rounds = Number.isFinite(confirmRounds) && confirmRounds > 0 ? confirmRounds : 4;
  await algosdk.waitForConfirmation(algod, txid, rounds);
  return { txId: txid };
}
