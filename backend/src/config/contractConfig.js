import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load SentinelPayment contract info from env or contract/contract_info.json.
 */
export function getContractConfig() {
  const jsonPath =
    process.env.CONTRACT_INFO_PATH ||
    join(__dirname, "..", "..", "..", "contract", "contract_info.json");

  let fromFile = { address: "", chainId: 84532 };
  try {
    if (existsSync(jsonPath)) {
      fromFile = JSON.parse(readFileSync(jsonPath, "utf8"));
    }
  } catch (e) {
    console.error("[contractConfig] read contract_info.json:", e?.message || e);
  }

  return {
    address: String(process.env.CONTRACT_ADDRESS || fromFile.address || "").trim(),
    chainId: Number(process.env.CHAIN_ID || fromFile.chainId || 84532),
  };
}
