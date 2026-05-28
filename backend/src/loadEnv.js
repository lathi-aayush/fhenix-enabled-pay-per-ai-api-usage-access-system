/**
 * Load backend/.env before any other app modules (ESM import order).
 * Default dotenv only reads cwd — fails when dev is started from repo root.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");

dotenv.config({ path: envPath });

// Fallback if only treasury wallet was configured earlier
if (!process.env.RECEIVER_WALLET?.trim() && process.env.TREASURY_WALLET?.trim()) {
  process.env.RECEIVER_WALLET = process.env.TREASURY_WALLET.trim();
}

console.log("[env] .env path:", envPath);
console.log("[env] RECEIVER_WALLET:", process.env.RECEIVER_WALLET ? "loaded" : "MISSING");
console.log("[env] ALGO_INDEXER_URL:", process.env.ALGO_INDEXER_URL ? "loaded" : "MISSING");
console.log(
  "[env] GOOGLE_API_KEY:",
  process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() ? "loaded" : "MISSING (Prompt Generator disabled)"
);
