import mongoose from "mongoose";
import { Transaction } from "../models/Transaction.js";
import { TopUpIntent } from "../models/TopUpIntent.js";
import { Withdrawal } from "../models/Withdrawal.js";
import { migrateServicePricing } from "../migrations/servicePricing.js";

function agentLog(hypothesisId, location, message, data = {}) {
  // #region agent log
  fetch("http://127.0.0.1:7788/ingest/4b0d5b8c-41a2-4139-98e0-1384e9a720fa", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "655066" },
    body: JSON.stringify({
      sessionId: "655066",
      runId: process.env.RENDER ? "render" : "local",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

function describeMongoUri(uri) {
  if (!uri) return { present: false };
  const isAtlas = uri.includes("mongodb+srv://");
  const isLocal = uri.includes("localhost") || uri.includes("127.0.0.1");
  return { present: true, isAtlas, isLocal };
}

function formatMongoConnectError(e, uri) {
  const hint = describeMongoUri(uri);
  if (e?.name === "MongooseServerSelectionError") {
    return new Error(
      "Cannot reach MongoDB. On Render set MONGO_URI to a reachable Atlas URI and allow 0.0.0.0/0 in Atlas Network Access."
    );
  }
  if (e?.code === 8000 || e?.codeName === "AtlasError") {
    return new Error(
      "MongoDB Atlas authentication failed (code 8000). Check MONGO_URI username/password in Render env vars and URL-encode special characters in the password."
    );
  }
  if (hint.isLocal && process.env.RENDER) {
    return new Error(
      "MONGO_URI points to localhost but this service runs on Render. Set MONGO_URI to your MongoDB Atlas connection string in Render environment variables."
    );
  }
  return e;
}

export async function connectDb() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI or MONGO_URI is required");

  const uriHint = describeMongoUri(uri);
  agentLog("H1", "db.js:connectDb", "mongo connect attempt", {
    ...uriHint,
    render: Boolean(process.env.RENDER),
  });

  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(uri);
    agentLog("H1", "db.js:connectDb", "mongo connect success", { readyState: mongoose.connection.readyState });
  } catch (e) {
    agentLog("H1", "db.js:connectDb", "mongo connect failed", {
      name: e?.name,
      code: e?.code,
      codeName: e?.codeName,
      message: e?.message,
      ...uriHint,
    });
    throw formatMongoConnectError(e, uri);
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
