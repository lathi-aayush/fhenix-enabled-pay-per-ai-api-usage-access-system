import { api } from "./client.js";

/**
 * Proxy-authenticated x402 on POST /api/use (Bearer sk-sentinel-* required).
 *
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.serviceId
 * @param {object} opts.body
 * @param {string} opts.algodServer
 * @param {{ addr: string, sk: Uint8Array }} opts.burnerWallet
 */
export async function callProxyX402Use({ apiKey, serviceId, body, algodServer, burnerWallet }) {
  const headers = { Authorization: `Bearer ${apiKey}` };

  let challengeData;
  try {
    await api.post("/api/use", body, { headers });
    throw new Error("Expected HTTP 402 Payment Required");
  } catch (e) {
    if (e?.response?.status !== 402) {
      const msg = e?.response?.data?.error || e?.response?.data?.detail || e?.message;
      throw new Error(msg || "x402 challenge request failed");
    }
    challengeData = e.response.data;
  }

  const accept = challengeData?.accepts?.[0];
  if (!accept?.payTo || accept.maxAmountRequired == null) {
    throw new Error("Invalid x402 payment challenge from server");
  }

  const receiver = String(accept.payTo).trim();
  const amountMicroAlgos = Math.round(Number(accept.maxAmountRequired));
  if (!Number.isFinite(amountMicroAlgos) || amountMicroAlgos <= 0) {
    throw new Error("Invalid x402 charge amount from server");
  }

  const algosdk = (await import("algosdk")).default;
  const algod = new algosdk.Algodv2("", algodServer.trim(), "");

  let burnerBalanceInfo;
  try {
    burnerBalanceInfo = await algod.accountInformation(burnerWallet.addr).do();
  } catch {
    throw new Error("Burner wallet has zero balance. Please click 'Manage' > 'Fund' in the top bar.");
  }

  const params = await algod.getTransactionParams().do();
  const txFee = Number(params.fee) || 1000;
  if (Number(burnerBalanceInfo.amount) < amountMicroAlgos + txFee) {
    throw new Error(
      `Burner wallet does not have enough funds. Required: ${(amountMicroAlgos + txFee) / 1_000_000} ALGO.`
    );
  }

  const note = new TextEncoder().encode(`x402:sentinel:${serviceId}`);
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: burnerWallet.addr,
    receiver,
    amount: amountMicroAlgos,
    note,
    suggestedParams: params,
  });

  const signedTxn = txn.signTxn(burnerWallet.sk);
  const submitted = await algod.sendRawTransaction(signedTxn).do();
  const txId = submitted?.txid ?? submitted?.txId;
  if (!txId) {
    throw new Error("Network did not return a transaction id after submit.");
  }
  await algosdk.waitForConfirmation(algod, txId, 4);

  const paymentPayload = {
    paymentGroup: [Buffer.from(signedTxn).toString("base64")],
    paymentIndex: 0,
  };
  const xPaymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");

  const { data: final } = await api.post("/api/use", body, {
    headers: { ...headers, "X-Payment": xPaymentHeader },
  });

  const receipt = final?.sentinelReceipt ?? null;
  const { sentinelReceipt: _sr, ...aiResponse } = final || {};

  return { aiResponse, txId, receipt };
}
