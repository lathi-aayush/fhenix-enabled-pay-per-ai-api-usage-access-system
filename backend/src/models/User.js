import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, unique: true, sparse: true, trim: true },
    firebaseUid: { type: String, unique: true, sparse: true, trim: true },
    email: { type: String, unique: true, sparse: true, trim: true },
    displayName: { type: String, unique: true, sparse: true, trim: true },
    photoURL: { type: String, trim: true },
    role: { type: String, enum: ["user", "creator"], required: true, default: "user" },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const User = mongoose.model("User", userSchema);
