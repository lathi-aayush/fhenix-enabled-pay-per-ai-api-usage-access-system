import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * ALGO_APP_ID / ALGO_CONTRACT_ADDRESS from env, or contract/contract_info.json (repo root).
 */
export function getContractConfig() {
  const jsonPath =
    process.env.CONTRACT_INFO_PATH ||
    join(__dirname, "..", "..", "..", "contract", "contract_info.json");
  let fromFile = { appId: 0, contractAddress: "" };
  try {
    if (existsSync(jsonPath)) {
      fromFile = JSON.parse(readFileSync(jsonPath, "utf8"));
    }
  } catch (e) {
    console.error("[contractConfig] read contract_info.json:", e?.message || e);
  }
  return {
    appId: Number(process.env.ALGO_APP_ID || fromFile.appId || 0) || 0,
    contractAddress: String(
      process.env.ALGO_CONTRACT_ADDRESS || fromFile.contractAddress || ""
    ).trim(),
  };
}
