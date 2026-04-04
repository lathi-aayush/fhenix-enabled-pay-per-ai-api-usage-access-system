import mongoose from "mongoose";

const apiUsageLogSchema = new mongoose.Schema(
  {
    userWallet: { type: String, required: true, index: true },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },
    accessTokenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccessToken",
    },
    developerWallet: { type: String, index: true },
    /** ALGO paid or charged for this row (same as chargeAlgo when paid) */
    amountAlgo: { type: Number, required: true },
    aiProvider: { type: String },
    modelName: { type: String },
    /** User → developer on-chain pay tx (replay-protected when success) */
    paymentTxId: { type: String },
    /** @deprecated Legacy field from platform-payout era; not written for new logs */
    payoutTxId: { type: String },
    /** UUID embedded in the payment transaction note */
    paymentRef: { type: String },
    success: { type: Boolean, default: true },
    errorDetail: { type: String },
    promptTokens: { type: Number },
    completionTokens: { type: Number },
    totalTokens: { type: Number },
    chargeAlgo: { type: Number },
    /** Snapshot of developer rate at time of call */
    pricePerThousandTokens: { type: Number },
    /** Optional on-chain proof-of-intelligence log tx */
    proofTxId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

apiUsageLogSchema.index({ createdAt: -1 });
apiUsageLogSchema.index(
  { paymentTxId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      success: true,
      paymentTxId: { $exists: true, $type: "string", $gt: "" },
    },
  }
);

export const ApiUsageLog = mongoose.model("ApiUsageLog", apiUsageLogSchema);
