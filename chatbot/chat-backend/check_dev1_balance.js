import algosdk from "algosdk";

const mnemonic = "art brain subway volume usage wolf retreat camp produce submit frame idle garlic pink resource genre vast fly solve off right decorate destroy absent fee";
const account = algosdk.mnemonicToSecretKey(mnemonic);
console.log("dev1 burner address:", account.addr.toString());

const algodServer = "https://testnet-api.algonode.cloud";
const algod = new algosdk.Algodv2("", algodServer, "");

async function run() {
  try {
    const accountInfo = await algod.accountInformation(account.addr).do();
    console.log("Balance (microAlgos):", accountInfo.amount);
    console.log("Balance (Algos):", Number(accountInfo.amount) / 1000000);
  } catch (err) {
    console.error("Error fetching balance:", err.message);
  }
}

run();
