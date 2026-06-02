import mongoose from "mongoose";

const PRICING_MODELS = [
  "per_request",
  "per_1000_requests",
  "per_token",
  "per_1000_tokens",
  "subscription",
];

const AUTH_TYPES = ["none", "bearer", "api_key", "basic"];

const proxyApiSchema = new mongoose.Schema(
  {
    developerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    developerWallet: { type: String, index: true },
    /** Link to legacy marketplace Service document */
    legacyServiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      unique: true,
      sparse: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    baseUrl: { type: String, required: true, trim: true },
    proxySlug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    pricingModel: {
      type: String,
      enum: PRICING_MODELS,
      default: "per_request",
    },
    pricePerUnit: { type: Number, required: true, min: 0 },
    authType: { type: String, enum: AUTH_TYPES, default: "bearer" },
    authHeaderEncrypted: { type: String },
    streamingSupported: { type: Boolean, default: true },
    timeoutMs: { type: Number, default: 30000 },
    isActive: { type: Boolean, default: true, index: true },
    aiProvider: {
      type: String,
      enum: [
        "groq",
        "openai",
        "anthropic",
        "together",
        "gemini",
        "openrouter",
        "mistral",
        "deepseek",
        "fireworks",
        "xai",
        "perplexity",
        "custom",
      ],
    },
    modelName: { type: String, default: "" },
    customEndpointUrl: { type: String, default: "" },
    category: { type: String, default: "ai", index: true, trim: true },
    tags: [{ type: String, trim: true }],
    callCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

proxyApiSchema.index({ developerId: 1, isActive: 1 });

export const ProxyApi = mongoose.model("ProxyApi", proxyApiSchema);
