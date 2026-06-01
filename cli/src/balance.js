import algosdk from "algosdk";

function getAlgodClient(network) {
  const isMainnet = network.toLowerCase() === "mainnet";
  const server = isMainnet
    ? "https://mainnet-api.algonode.cloud"
    : "https://testnet-api.algonode.cloud";
  return new algosdk.Algodv2("", server, "");
}

export async function runBalance(options) {
  const { address, network } = options;
  if (!algosdk.isValidAddress(address)) {
    throw new Error(`Invalid Algorand address: ${address}`);
  }

  const client = getAlgodClient(network);
  console.log(`Connecting to Algorand ${network}...`);
  
  const acctInfo = await client.accountInformation(address).do();
  const balanceAlgo = Number(acctInfo.amount) / 1e6;
  const minBalanceAlgo = Number(acctInfo.minBalance || 0) / 1e6;

  console.log("\n========================================");
  console.log(`Address:     ${address}`);
  console.log(`Network:     ${network.toUpperCase()}`);
  console.log(`Balance:     ${balanceAlgo.toFixed(6)} ALGO`);
  console.log(`Min Balance: ${minBalanceAlgo.toFixed(6)} ALGO`);
  console.log("========================================\n");
}
