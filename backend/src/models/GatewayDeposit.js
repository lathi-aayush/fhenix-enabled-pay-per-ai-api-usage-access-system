import mongoose from "mongoose";

const gatewayDepositSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    txId: { type: String, required: true, unique: true },
    amountWei: { type: Number, required: true },
    amountCents: { type: Number, required: true },
    senderAddress: { type: String },
    status: {
      type: String,
      enum: ["pending", "confirmed", "failed"],
      default: "pending",
    },
    blockNumber: { type: Number },
  },
  { timestamps: true }
);

export const GatewayDeposit = mongoose.model("GatewayDeposit", gatewayDepositSchema);
