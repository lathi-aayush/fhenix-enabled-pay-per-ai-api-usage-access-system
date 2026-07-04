import mongoose from "mongoose";

const txRecordSchema = new mongoose.Schema(
  {
    txId: { type: String, required: true, unique: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tier: {
      type: String,
      enum: ["creator", "pro", "enterprise"],
      required: true,
    },
    amountWei: { type: Number, required: true },
    confirmedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const TxRecord = mongoose.model("TxRecord", txRecordSchema);
