import mongoose from "mongoose";

const walletTopUpSchema = new mongoose.Schema(
  {
    userWallet: { type: String, required: true, index: true },
    amountAlgo: { type: Number, required: true },
    paymentIntentId: { type: String, required: true, unique: true },
    txId: { type: String },
    status: {
      type: String,
      enum: ["pending", "verified", "failed"],
      default: "pending",
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

walletTopUpSchema.index(
  { txId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      txId: { $exists: true, $type: "string", $gt: "" },
    },
  }
);

export const WalletTopUp = mongoose.model("WalletTopUp", walletTopUpSchema);
