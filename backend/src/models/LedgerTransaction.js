import mongoose from "mongoose";

const ledgerTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["deposit", "deduction", "earning", "payout", "refund"],
      required: true,
    },
    amountCents: { type: Number, required: true },
    balanceAfterCents: { type: Number },
    referenceId: { type: String, index: true },
    chainTxId: { type: String, sparse: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "failed"],
      default: "confirmed",
    },
  },
  { timestamps: true }
);

export const LedgerTransaction = mongoose.model("LedgerTransaction", ledgerTransactionSchema);
