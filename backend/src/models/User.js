import mongoose from "mongoose";
import { getPlanCredits } from "../constants/studioPlans.js";

const overageEntrySchema = new mongoose.Schema(
  {
    runType: { type: String, required: true },
    ethAmount: { type: Number, required: true },
    txId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    settled: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, unique: true, sparse: true, trim: true },
    firebaseUid: { type: String, unique: true, sparse: true, trim: true },
    email: { type: String, unique: true, sparse: true, trim: true },
    displayName: { type: String, unique: true, sparse: true, trim: true },
    photoURL: { type: String, trim: true },
    role: { type: String, enum: ["user", "creator"], required: true, default: "user" },
    sessionKeyEncrypted: { type: String, trim: true },
    subscriptionTier: {
      type: String,
      enum: ["free", "creator", "pro", "enterprise"],
      default: "free",
    },
    /** Weighted Studio Credit wallet (replaces flat prompt/AI run counts). */
    studioCredits: { type: Number, default: 15 },
    studioOverageLog: { type: [overageEntrySchema], default: [] },
    monthlyBlogsUsed: { type: Number, default: 0 },
    monthlyPromptsUsed: { type: Number, default: 0 },
    usageResetAt: { type: Date },
    /** v2 gateway: prepaid balance in USD cents */
    walletBalanceCents: { type: Number, default: 0, min: 0 },
    /** v2 gateway: master key for POST /proxy/:slug */
    sentinelApiKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

userSchema.index({ "studioOverageLog.txId": 1 });

userSchema.methods.resetMonthlyCredits = function resetMonthlyCredits() {
  const tier = this.subscriptionTier || "free";
  this.studioCredits = getPlanCredits(tier);
  return this.studioCredits;
};

userSchema.pre("save", function enforceNonNegativeCredits(next) {
  if (typeof this.studioCredits === "number" && this.studioCredits < 0) {
    this.studioCredits = 0;
  }
  next();
});

export const User = mongoose.model("User", userSchema);
