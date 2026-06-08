/**
 * Load backend/.env before any other app modules (ESM import order).
 * Default dotenv only reads cwd — fails when dev is started from repo root.
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { probePlatformMnemonic, getPlatformTreasuryKey } from "./services/platformTreasuryKey.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");

dotenv.config({ path: envPath });

// Fallback if only treasury / sentinel wallet was configured earlier
if (!process.env.RECEIVER_WALLET?.trim() && process.env.TREASURY_WALLET?.trim()) {
  process.env.RECEIVER_WALLET = process.env.TREASURY_WALLET.trim();
}
if (!process.env.RECEIVER_WALLET?.trim() && process.env.SENTINEL_WALLET_ADDRESS?.trim()) {
  process.env.RECEIVER_WALLET = process.env.SENTINEL_WALLET_ADDRESS.trim();
}

console.log("[env] .env path:", envPath);
if (process.env.REDIS_DISABLED === "1") {
  console.log("[env] REDIS_URL: disabled (REDIS_DISABLED=1)");
} else {
  const rawRedis = process.env.REDIS_URL?.trim().replace(/^["']|["']$/g, "");
  if (rawRedis) {
    try {
      const { hostname, port, protocol } = new URL(rawRedis);
      console.log("[env] REDIS_URL:", `loaded (${protocol}//${hostname}:${port || 6379})`);
    } catch {
      console.warn("[env] REDIS_URL: present but invalid URL");
    }
  } else {
    console.log("[env] REDIS_URL: not set (will try localhost:6379 at startup)");
  }
}
console.log("[env] RECEIVER_WALLET:", process.env.RECEIVER_WALLET ? "loaded" : "MISSING");
console.log("[env] ALGO_INDEXER_URL:", process.env.ALGO_INDEXER_URL ? "loaded" : "MISSING");
console.log(
  "[env] GOOGLE_API_KEY:",
  process.env.GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() ? "loaded" : "MISSING (Prompt Generator disabled)"
);

const gcpCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
if (gcpCreds) {
  const credsPath = path.isAbsolute(gcpCreds)
    ? gcpCreds
    : path.resolve(path.dirname(envPath), gcpCreds);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;
  if (fs.existsSync(credsPath)) {
    console.log("[env] GOOGLE_APPLICATION_CREDENTIALS:", "loaded");
  } else {
    console.warn("[env] GOOGLE_APPLICATION_CREDENTIALS: file not found at", credsPath);
  }
} else {
  console.log("[env] GOOGLE_APPLICATION_CREDENTIALS:", "not set (Vertex Imagen/Veo disabled)");
}

if (process.env.GOOGLE_CLOUD_PROJECT?.trim()) {
  console.log("[env] GOOGLE_CLOUD_PROJECT:", process.env.GOOGLE_CLOUD_PROJECT.trim());
}

const gcsBucket = process.env.GCS_ASSETS_BUCKET?.trim();
if (gcsBucket && process.env.GOOGLE_CLOUD_PROJECT?.trim()) {
  console.log("[env] GCS_ASSETS_BUCKET:", gcsBucket, "(pipeline + workflow assets → signed URLs)");
} else if (gcsBucket) {
  console.warn("[env] GCS_ASSETS_BUCKET set but GOOGLE_CLOUD_PROJECT missing");
} else {
  console.log("[env] GCS_ASSETS_BUCKET: not set (assets saved under backend/outputs/pipeline)");
}

if (process.env.VERTEX_IMAGEN_ENABLED === "true") {
  console.log("[env] VERTEX_IMAGEN_ENABLED: true (Imagen via Vertex; needs aiplatform.user)");
} else {
  console.log("[env] Workflow images: Gemini (GOOGLE_API_KEY). Set VERTEX_IMAGEN_ENABLED=true for Imagen.");
}

const vertexKey = (process.env.VERTEX_API_KEY || process.env.VERTEX_AI_API_KEY || "").trim();
if (vertexKey) {
  console.log("[env] VERTEX_API_KEY: loaded (used if service account is not set)");
} else {
  console.log("[env] VERTEX_API_KEY: not set (optional; from Vertex AI Studio express mode)");
}

if (process.env.GOOGLE_CLOUD_PROJECT?.trim() && gcsBucket) {
  console.log("[env] Veo video: configured (requires Model Garden allowlist on project)");
} else if (process.env.GOOGLE_CLOUD_PROJECT?.trim()) {
  console.warn("[env] Veo video: set GCS_ASSETS_BUCKET for Veo output storage");
}

const platformProbe = probePlatformMnemonic();
if (platformProbe.status === "missing") {
  console.warn("[env] PLATFORM_MNEMONIC: not set (creator withdrawals disabled)");
} else if (platformProbe.status === "ok") {
  console.log(
    `[env] PLATFORM_MNEMONIC: valid treasury (${platformProbe.mode})`,
    platformProbe.addr.slice(0, 8) + "…"
  );
} else if (platformProbe.status === "bip39_pending") {
  console.log(
    `[env] PLATFORM_MNEMONIC: ${platformProbe.wordCount}-word Pera Universal phrase (BIP-39); deriving treasury on first withdraw…`
  );
  void getPlatformTreasuryKey()
    .then((t) => {
      console.log("[env] PLATFORM_MNEMONIC: treasury ready", t.addr.slice(0, 8) + "…", `(${t.mode})`);
    })
    .catch((err) => {
      console.warn("[env] PLATFORM_MNEMONIC:", err.message);
    });
} else {
  console.warn(
    `[env] PLATFORM_MNEMONIC: invalid (${platformProbe.wordCount} words; use 25-word Algorand or 24-word Pera Universal phrase)`
  );
}
