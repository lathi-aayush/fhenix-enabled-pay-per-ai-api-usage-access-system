import crypto from "crypto";
import algosdk, { waitForConfirmation } from "algosdk";

/**
 * On-chain proof log: platform → PROOF_LOG_ADDRESS with note proof of intelligence:<sha256hex>
 * Does not block callers; errors are logged only.
 */
export async function submitProofOfIntelligence({
  promptText,
  responseText,
  userWallet,
  serviceId,
  timestamp,
}) {
  try {
    const mn = process.env.PLATFORM_MNEMONIC?.trim();
    const proofAddr = (
      process.env.PROOF_LOG_ADDRESS ||
      process.env.PLATFORM_WALLET_ADDRESS ||
      ""
    ).trim();
    if (!mn || !proofAddr) {
      console.error(
        "[proof-of-intelligence] missing PLATFORM_MNEMONIC or PROOF_LOG_ADDRESS / PLATFORM_WALLET_ADDRESS"
      );
      return null;
    }
    if (!algosdk.isValidAddress(proofAddr)) {
      console.error("[proof-of-intelligence] invalid PROOF_LOG_ADDRESS");
      return null;
    }

    const payload = [
      String(promptText ?? ""),
      String(responseText ?? ""),
      String(userWallet ?? ""),
      String(serviceId ?? ""),
      String(timestamp ?? new Date().toISOString()),
    ].join("|");
    const hash = crypto.createHash("sha256").update(payload, "utf8").digest("hex");
    const noteStr = `proof of intelligence:${hash}`;
    const note = new Uint8Array(Buffer.from(noteStr, "utf8"));

    const server = (
      process.env.ALGOD_SERVER ||
      process.env.ALGORAND_NODE ||
      "https://testnet-api.algonode.cloud"
    ).replace(/\/$/, "");
    const token = process.env.ALGOD_TOKEN || "";
    const client = new algosdk.Algodv2(token, server, "");

    const { addr, sk } = algosdk.mnemonicToSecretKey(mn);
    const sp = await client.getTransactionParams().do();
    const amount = 1000;

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: addr,
      to: proofAddr,
      amount,
      note,
      suggestedParams: sp,
    });
    const signed = txn.signTxn(sk);
    const { txId } = await client.sendRawTransaction(signed).do();
    await waitForConfirmation(client, txId, 6);
    return txId;
  } catch (e) {
    console.error("[proof-of-intelligence]", e?.message || e);
    return null;
  }
}
