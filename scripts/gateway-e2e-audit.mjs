#!/usr/bin/env node
/**
 * Gateway v2 audit — validates models, env, and documents the E2E flow.
 * Usage: node scripts/gateway-e2e-audit.mjs
 * Requires MONGODB_URI (and optionally REDIS_URL) in backend/.env
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../backend/.env") });

const FLOW = [
  "1. Deposit: POST /api/gateway/deposit/confirm (vault ETH → walletBalanceCents)",
  "2. Subscribe: POST /api/gateway/subscribe → developerIssuedKey",
  "3. Proxy: POST /proxy/:slug/* with Bearer key",
  "4. Usage: UsageRecord + apiKeyPrefix + subscriptionId",
  "5. Tokens: extractTokensFromProviderBody / SSE parser",
  "6. Balance: Redis lock → finalize/refund",
  "7. Earnings: DeveloperEarning (platform fee split)",
  "8. Payout: POST /api/gateway/developer/payout",
  "9. Analytics: Redis period counters + DailyStats",
];

async function main() {
  console.log("=== Gateway v2 E2E Audit ===\n");
  console.log("Flow steps:\n", FLOW.join("\n"), "\n");

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("FAIL: MONGODB_URI not set");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const { runGatewayHealthAudit } = await import(
    "../backend/src/services/gatewayAuditService.js"
  );
  const report = await runGatewayHealthAudit();
  await mongoose.disconnect();

  for (const c of report.checks) {
    console.log(`${c.ok ? "OK" : "FAIL"}  ${c.name}: ${c.detail}`);
  }
  console.log(`\nOverall: ${report.ok ? "PASS" : "NEEDS ATTENTION"}`);
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
