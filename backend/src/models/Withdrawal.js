import mongoose from "mongoose";

const withdrawalSchema = new mongoose.Schema(
  {
    creatorWallet: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amountAlgo: { type: Number, required: true, min: 0.001 },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    txId: { type: String },
    errorDetail: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);
