export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  messages?: ChatMessage[];
  prompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  max_tokens?: number;
  /** Used in x402 payment transaction note (optional). */
  serviceId?: string;
  /** Reserved for v1.1 streaming support */
  stream?: boolean;
}

export type AlgorandNetwork = "testnet" | "mainnet";

export interface SentinelClientOptions {
  /** `sk-sentinel-...` API key from POST /api/access/generate */
  apiKey: string;
  /** Base URL of the Sentinel API (no trailing slash). Default: https://testnet-api.sentinel.ai or localhost */
  baseUrl?: string;
  /** Algorand network for payment submission. Default: testnet */
  network?: AlgorandNetwork;
  /** Algod server URL. Defaults based on `network`. */
  algodServer?: string;
  /** Algod API token (empty for public nodes). */
  algodToken?: string;
  /** Request timeout in milliseconds. Default: 120000 */
  timeout?: number;
}

export interface InvokeResponse {
  awaitingPayment: true;
  paymentRef: string;
  chargeAlgo: number;
  expectedMicroAlgos: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  pricePerThousandTokens: number;
  minimumChargeAlgo: number;
  developerWallet: string;
}

export interface SentinelReceipt {
  paymentProtocol?: "x402";
  paymentTxId: string;
  chargeAlgo: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  pricePerThousandTokens: number;
  payerWallet?: string;
}

export interface ChatChoice {
  index?: number;
  message?: {
    role?: string;
    content?: string;
  };
  finish_reason?: string;
}

export interface CompleteResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: ChatChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  sentinelReceipt: SentinelReceipt;
}

export interface ServicePublicInfo {
  id: string;
  name: string;
  description: string;
  pricePerThousandTokens: number;
  minimumChargeAlgo: number;
  aiProvider: string | null;
  modelName: string;
  averageRating: number;
  reviewCount: number;
  x402Enabled: boolean;
  providerConfigured: boolean;
}

export interface X402ClientOptions {
  /** Base URL of the Sentinel API (no trailing slash). */
  baseUrl?: string;
  /** Algorand network for payment submission. Default: testnet */
  network?: AlgorandNetwork;
  algodServer?: string;
  algodToken?: string;
  timeout?: number;
}

export interface X402SentinelReceipt {
  paymentProtocol: "x402";
  paymentTxId: string;
  serviceId: string;
  amountAlgo: number;
  network: string;
}

export interface X402CompleteResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: ChatChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  sentinelReceipt: X402SentinelReceipt;
}

export interface ApiErrorBody {
  error?: string;
  detail?: string;
  errors?: unknown;
}
