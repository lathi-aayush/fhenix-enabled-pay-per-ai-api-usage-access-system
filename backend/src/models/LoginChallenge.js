import mongoose from "mongoose";

const loginChallengeSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: true, index: true },
    nonce: { type: String, required: true, unique: true },
    message: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    used: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

loginChallengeSchema.index({ walletAddress: 1, nonce: 1 });

export const LoginChallenge = mongoose.model("LoginChallenge", loginChallengeSchema);
