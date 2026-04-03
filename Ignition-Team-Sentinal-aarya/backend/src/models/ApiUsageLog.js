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
    amountAlgo: { type: Number, required: true },
    aiProvider: { type: String },
    modelName: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

apiUsageLogSchema.index({ createdAt: -1 });

export const ApiUsageLog = mongoose.model("ApiUsageLog", apiUsageLogSchema);
