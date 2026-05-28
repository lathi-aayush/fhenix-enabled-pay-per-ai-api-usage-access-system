import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, unique: true, sparse: true, trim: true },
    firebaseUid: { type: String, unique: true, sparse: true, trim: true },
    email: { type: String, unique: true, sparse: true, trim: true },
    displayName: { type: String, unique: true, sparse: true, trim: true },
    photoURL: { type: String, trim: true },
    role: { type: String, enum: ["user", "creator"], required: true, default: "user" },
    burnerWalletEncrypted: { type: String, trim: true },
    subscriptionTier: {
      type: String,
      enum: ["free", "creator", "pro", "enterprise"],
      default: "free",
    },
    monthlyBlogsUsed: { type: Number, default: 0 },
    monthlyPromptsUsed: { type: Number, default: 0 },
    usageResetAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const User = mongoose.model("User", userSchema);
