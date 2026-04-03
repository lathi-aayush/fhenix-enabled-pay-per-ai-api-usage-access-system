import mongoose from "mongoose";

const userBalanceSchema = new mongoose.Schema(
  {
    userWallet: { type: String, required: true, unique: true, index: true },
    balanceMicroAlgos: { type: Number, default: 0, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const UserBalance = mongoose.model("UserBalance", userBalanceSchema);
