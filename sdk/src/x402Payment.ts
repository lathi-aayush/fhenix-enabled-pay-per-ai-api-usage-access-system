import algosdk from "algosdk";
import { SDK_VERSION, SentinelNetworkError, SentinelPaymentError } from "./errors.js";
import type { ApiErrorBody } from "./types.js";
import { createAlgodClient, submitSignedPayment } from "./algorand.js";
import type { Signer } from "./signer.js";
import type { AlgorandNetwork } from "./types.js";

export interface X402ChallengeAccept {
  payTo: string;
  maxAmountRequired: string;
}

export interface X402ChallengeBody {
  accepts?: X402ChallengeAccept[];
  error?: string;
}

export interface BuildX402PaymentHeaderParams {
  serviceId: string;
  payTo: string;
  amountMicroAlgos: number;
  signer: Signer;
  algodClient: algosdk.Algodv2;
}

/** Build, sign, submit a single ALGO payment and return the base64 X-Payment header value. */
export async function buildX402PaymentHeader(
  params: BuildX402PaymentHeaderParams
): Promise<{ xPaymentHeader: string; txId: string }> {
  const { serviceId, payTo, amountMicroAlgos, signer, algodClient } = params;
  const amt = Math.round(amountMicroAlgos);
  if (!Number.isFinite(amt) || amt <= 0) {
    throw new SentinelPaymentError("Invalid x402 payment amount");
  }

  const suggestedParams = await algodClient.getTransactionParams().do();
  const note = new TextEncoder().encode(`x402:sentinel:${serviceId}`);
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: signer.address,
    receiver: payTo.trim(),
    amount: amt,
    note,
    suggestedParams,
  });

  const signedTxn = await signer.sign(txn);
  const txId = await submitSignedPayment({ signedTxn, algodClient });

  const paymentPayload = {
    paymentGroup: [Buffer.from(signedTxn).toString("base64")],
    paymentIndex: 0,
  };
  const xPaymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
  return { xPaymentHeader, txId };
}

export interface PostX402Options {
  baseUrl: string;
  path: string;
  body: unknown;
  apiKey?: string;
  xPaymentHeader?: string;
  timeout?: number;
}

/** POST to an x402 endpoint; returns response or throws with challenge body on 402. */
export async function postX402Endpoint<T>(options: PostX402Options): Promise<{
  status: number;
  data: T;
}> {
  const url = `${options.baseUrl.replace(/\/$/, "")}${options.path}`;
  const controller = new AbortController();
  const timeout = options.timeout ?? 120_000;
  const timer = setTimeout(() => controller.abort(), timeout);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": `@sentinalapi/sdk@${SDK_VERSION}`,
    "X-Sentinel-SDK-Version": SDK_VERSION,
  };
  if (options.apiKey) {
    headers["X-API-Key"] = options.apiKey;
    headers.Authorization = `Bearer ${options.apiKey}`;
  }
  if (options.xPaymentHeader) {
    headers["X-Payment"] = options.xPaymentHeader;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(options.body),
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: ApiErrorBody & Record<string, unknown> = {};
    if (text) {
      try {
        parsed = JSON.parse(text) as ApiErrorBody & Record<string, unknown>;
      } catch {
        parsed = { error: text };
      }
    }

    if (res.status === 402 && !options.xPaymentHeader) {
      throw new SentinelPaymentError(parsed.error || "Payment required", {
        status: 402,
        body: parsed as ApiErrorBody,
      });
    }

    if (!res.ok) {
      const msg = parsed.error || parsed.detail || `HTTP ${res.status}`;
      throw new SentinelNetworkError(msg);
    }

    return { status: res.status, data: parsed as T };
  } catch (err) {
    if (err instanceof Error && err.name.startsWith("Sentinel")) {
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw new SentinelNetworkError(`Request timed out after ${timeout}ms`, { cause: err });
    }
    throw new SentinelNetworkError(
      err instanceof Error ? err.message : "Unknown network error",
      { cause: err }
    );
  } finally {
    clearTimeout(timer);
  }
}

export function parseX402Challenge(body: ApiErrorBody & Record<string, unknown>): {
  payTo: string;
  amountMicroAlgos: number;
} {
  const accepts = body.accepts as X402ChallengeAccept[] | undefined;
  const accept = accepts?.[0];
  if (!accept?.payTo || accept.maxAmountRequired == null) {
    throw new SentinelPaymentError("Invalid x402 payment challenge from server");
  }
  const amountMicroAlgos = Math.round(Number(accept.maxAmountRequired));
  if (!Number.isFinite(amountMicroAlgos) || amountMicroAlgos <= 0) {
    throw new SentinelPaymentError("Invalid x402 charge amount from server");
  }
  return { payTo: String(accept.payTo).trim(), amountMicroAlgos };
}

export function createX402AlgodClient(
  network: AlgorandNetwork,
  algodServer?: string,
  algodToken = ""
): algosdk.Algodv2 {
  return createAlgodClient(network, algodServer, algodToken);
}
