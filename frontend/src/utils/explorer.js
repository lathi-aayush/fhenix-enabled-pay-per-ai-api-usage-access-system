const LORA_BASE = "https://lora.algokit.io";

function loraNetwork(network) {
  return network === "mainnet" ? "mainnet" : "testnet";
}

/** Link to a transaction on Lora (defaults to testnet). */
export function testnetTxUrl(txId) {
  return explorerTxUrl("testnet", txId);
}

export function explorerTxUrl(network, txId) {
  if (!txId) return null;
  return `${LORA_BASE}/${loraNetwork(network)}/transaction/${txId}`;
}

export function explorerAddressUrl(network, address) {
  if (!address) return null;
  return `${LORA_BASE}/${loraNetwork(network)}/account/${address}`;
}

export function explorerApplicationUrl(network, appId) {
  if (appId == null || appId === "") return null;
  return `${LORA_BASE}/${loraNetwork(network)}/application/${appId}`;
}
