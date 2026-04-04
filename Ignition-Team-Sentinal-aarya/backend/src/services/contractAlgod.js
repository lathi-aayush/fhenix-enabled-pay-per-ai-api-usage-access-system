import algosdk from "algosdk";
import { getContractConfig } from "../config/contractConfig.js";

function getAlgod() {
  const server = (
    process.env.ALGOD_SERVER ||
    process.env.ALGORAND_NODE ||
    "https://testnet-api.algonode.cloud"
  ).replace(/\/$/, "");
  const token = process.env.ALGOD_TOKEN || "";
  return new algosdk.Algodv2(token, server, "");
}

function decodeGlobalKey(b64) {
  try {
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return "";
  }
}

/**
 * Reads uint globals from the Sentinel app (Puya field names as keys when available).
 */
export async function readContractGlobalUints() {
  const { appId } = getContractConfig();
  if (!appId) {
    return { minPayment: 0, totalPurchases: 0, totalAlgoReceivedMicro: 0, raw: {} };
  }
  try {
    const client = getAlgod();
    const app = await client.getApplicationByID(appId).do();
    const rows = app.params?.["global-state"] || [];
    const entries = [];
    const raw = {};
    for (const row of rows) {
      if (row.value?.type !== 2 || row.value.uint === undefined) continue;
      const key = decodeGlobalKey(row.key);
      const v = Number(row.value.uint);
      raw[key] = v;
      entries.push({ key, v });
    }
    entries.sort((a, b) => a.key.localeCompare(b.key));

    let minPayment =
      raw.min_payment ??
      raw.minPayment ??
      raw.min_payment_micro ??
      0;
    let totalPurchases = raw.total_purchases ?? raw.totalPurchases ?? raw.purchases ?? 0;
    let totalAlgoReceivedMicro =
      raw.total_algo_received ?? raw.totalAlgoReceived ?? raw.total_algo_received_micro ?? 0;

    if (entries.length >= 3 && (!minPayment || !totalPurchases)) {
      const [e0, e1, e2] = entries;
      minPayment = minPayment || e0.v;
      totalPurchases = totalPurchases || e1.v;
      totalAlgoReceivedMicro = totalAlgoReceivedMicro || e2.v;
    }

    return {
      minPayment,
      totalPurchases,
      totalAlgoReceivedMicro,
      raw,
    };
  } catch (e) {
    console.error("[contractAlgod] readContractGlobalUints:", e?.message || e);
    return { minPayment: 0, totalPurchases: 0, totalAlgoReceivedMicro: 0, raw: {} };
  }
}
