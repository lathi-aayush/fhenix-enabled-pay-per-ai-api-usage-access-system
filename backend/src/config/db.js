import mongoose from "mongoose";
import { Transaction } from "../models/Transaction.js";
import { TopUpIntent } from "../models/TopUpIntent.js";
import { Withdrawal } from "../models/Withdrawal.js";
import { migrateServicePricing } from "../migrations/servicePricing.js";

export async function connectDb() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI or MONGO_URI is required");
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(uri);
  } catch (e) {
    if (e?.name === "MongooseServerSelectionError") {
      throw new Error(
        `Cannot connect to MongoDB (${uri}). Start MongoDB first — on Windows run: .\\scripts\\start-mongo.ps1`
      );
    }
    throw e;
  }
  await migrateServicePricing();
  try {
    await Transaction.syncIndexes();
  } catch (e) {
    console.warn("Transaction.syncIndexes:", e?.message);
  }
  try {
    await TopUpIntent.syncIndexes();
  } catch (e) {
    console.warn("TopUpIntent.syncIndexes:", e?.message);
  }
  try {
    await Withdrawal.syncIndexes();
  } catch (e) {
    console.warn("Withdrawal.syncIndexes:", e?.message);
  }
}
