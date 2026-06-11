import algosdk from "algosdk";
import { buildPaymentTx, createAlgodClient, submitSignedPayment } from "./algorand.js";
import { HttpClient } from "./http.js";
import { SentinelPaymentError } from "./errors.js";
import {
  buildX402PaymentHeader,
  parseX402Challenge,
  postX402Endpoint,
} from "./x402Payment.js";
import type { Signer } from "./signer.js";
import type {
  ChatMessage,
  ChatOptions,
  CompleteResponse,
  InvokeResponse,
  SentinelClientOptions,
  ServicePublicInfo,
} from "./types.js";

const DEFAULT_BASE_URL = "http://localhost:5000";

function normalizeMessages(messages: ChatMessage[], opts?: ChatOptions): ChatMessage[] {
  if (messages.length > 0) return messages;
  if (opts?.prompt?.trim()) {
    return [{ role: "user", content: opts.prompt.trim() }];
  }
  throw new Error("Provide messages or opts.prompt");
}

function buildUseBody(messages: ChatMessage[], opts?: ChatOptions, extra?: Record<string, unknown>) {
  const body: Record<string, unknown> = {
    messages,
    ...extra,
  };
  if (opts?.model) body.model = opts.model;
  if (opts?.temperature !== undefined) body.temperature = opts.temperature;
  const maxTok = opts?.maxTokens ?? opts?.max_tokens;
  if (maxTok !== undefined) body.max_tokens = maxTok;
  return body;
}

export class SentinelClient {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly network: NonNullable<SentinelClientOptions["network"]>;
  readonly algodClient: algosdk.Algodv2;
  private readonly http: HttpClient;
  private readonly timeout: number;

  constructor(options: SentinelClientOptions) {
    if (!options.apiKey?.trim()) {
      throw new Error("SentinelClient requires a non-empty apiKey");
    }
    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.network = options.network ?? "testnet";
    this.timeout = options.timeout ?? 120_000;
    this.algodClient = createAlgodClient(this.network, options.algodServer, options.algodToken ?? "");
    this.http = new HttpClient(this.baseUrl, this.timeout);
  }

  /** Fetch public pricing/metadata for a service (no API key required). */
  async getServicePublicInfo(serviceId: string): Promise<ServicePublicInfo> {
    return this.http.request<ServicePublicInfo>({
      path: `/api/services/${encodeURIComponent(serviceId)}/public`,
    });
  }

  /** Phase 1: run AI and receive a payment quote (response cached server-side). */
  async invoke(messages: ChatMessage[], opts?: ChatOptions): Promise<InvokeResponse> {
    const msgs = normalizeMessages(messages, opts);
    const data = await this.http.request<InvokeResponse>({
      method: "POST",
      path: "/api/use",
      apiKey: this.apiKey,
      body: buildUseBody(msgs, opts),
    });
    if (!data.awaitingPayment || !data.paymentRef) {
      throw new Error("Unexpected invoke response: awaitingPayment and paymentRef are required");
    }
    return data;
  }

  /** Phase 2: verify on-chain payment and return the AI response + receipt. */
  async complete(paymentRef: string, txId: string): Promise<CompleteResponse> {
    const data = await this.http.request<CompleteResponse>({
      method: "POST",
      path: "/api/use",
      apiKey: this.apiKey,
      body: { paymentRef, txId },
    });
    if (!data.sentinelReceipt) {
      throw new Error("Unexpected complete response: missing sentinelReceipt");
    }
    return data;
  }

  /**
   * High-level helper: POST /api/use with proxy key.
   * - x402-enabled services: 402 challenge → pay → retry with X-Payment
   * - legacy services: quote → sign payment → submit → complete
   */
  async chat(
    messages: ChatMessage[],
    signer: Signer,
    opts?: ChatOptions
  ): Promise<CompleteResponse> {
    const msgs = normalizeMessages(messages, opts);
    const body = buildUseBody(msgs, opts);

    try {
      await postX402Endpoint({
        baseUrl: this.baseUrl,
        path: "/api/use",
        apiKey: this.apiKey,
        body,
        timeout: this.timeout,
      });
      return this.chatLegacy(messages, signer, opts);
    } catch (err) {
      if (!(err instanceof SentinelPaymentError) || err.status !== 402 || !err.body) {
        throw err;
      }
      const { payTo, amountMicroAlgos } = parseX402Challenge(
        err.body as Record<string, unknown> & { error?: string }
      );
      const serviceId = opts?.serviceId ?? "proxy";
      const { xPaymentHeader } = await buildX402PaymentHeader({
        serviceId,
        payTo,
        amountMicroAlgos,
        signer,
        algodClient: this.algodClient,
      });
      const { data } = await postX402Endpoint<CompleteResponse>({
        baseUrl: this.baseUrl,
        path: "/api/use",
        apiKey: this.apiKey,
        body,
        xPaymentHeader,
        timeout: this.timeout,
      });
      if (!data.sentinelReceipt) {
        throw new Error("Unexpected x402 complete response: missing sentinelReceipt");
      }
      return data;
    }
  }

  /** Legacy quote → pay → complete (non-x402 services). */
  async chatLegacy(
    messages: ChatMessage[],
    signer: Signer,
    opts?: ChatOptions
  ): Promise<CompleteResponse> {
    const quote = await this.invoke(messages, opts);

    const txn = await buildPaymentTx({
      from: signer.address,
      to: quote.developerWallet,
      microAlgos: quote.expectedMicroAlgos,
      paymentRef: quote.paymentRef,
      algodClient: this.algodClient,
    });

    const signed = await signer.sign(txn);
    const txId = await submitSignedPayment({
      signedTxn: signed,
      algodClient: this.algodClient,
    });

    return this.complete(quote.paymentRef, txId);
  }

  /** Extract assistant text from a CompleteResponse. */
  static getAssistantText(response: CompleteResponse): string {
    const content = response.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    return "";
  }
}
