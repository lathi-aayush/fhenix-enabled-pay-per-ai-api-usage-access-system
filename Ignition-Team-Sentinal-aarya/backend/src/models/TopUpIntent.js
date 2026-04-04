import mongoose from "mongoose";

const topUpIntentSchema = new mongoose.Schema(
  {
    userWallet: { type: String, required: true, index: true },
    paymentIntentId: { type: String, required: true, unique: true },
    amountMicroAlgos: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "verified"],
      default: "pending",
    },
    txId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const TopUpIntent = mongoose.model("TopUpIntent", topUpIntentSchema);
