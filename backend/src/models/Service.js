import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    /** ALGO charged per 1000 tokens (input + output) */
    pricePerThousandTokens: { type: Number, required: true, min: 0 },
    /** Floor charge per successful paid call (ALGO) */
    minimumChargeAlgo: { type: Number, required: true, min: 0 },
    creatorWallet: { type: String, required: true, index: true },
    totalUses: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
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
    /** For aiProvider === "custom": full base URL, e.g. https://my-server.com/v1 */
    customEndpointUrl: { type: String, default: "" },
    /** AES-256-GCM payload; never exposed via API */
    encryptedApiKey: { type: String },
    modelName: { type: String, default: "" },
    isPaused: { type: Boolean, default: false },
    isSentinalOfficial: { type: Boolean, default: false },
    /** When true, service is available via the x402 keyless payment endpoint */
    x402Enabled: { type: Boolean, default: false },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const Service = mongoose.model("Service", serviceSchema);
