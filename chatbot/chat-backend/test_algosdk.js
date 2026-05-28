import algosdk from "algosdk";

const mnemonic = "lecture rocket indicate pig veteran mixed planet above eye link crime island opera pass frost butter surprise narrow cook stable hunt topic city ability gown";
const account = algosdk.mnemonicToSecretKey(mnemonic);

const algodServer = "https://testnet-api.algonode.cloud";
const algod = new algosdk.Algodv2("", algodServer, "");

async function run() {
  try {
    const params = await algod.getTransactionParams().do();
    
    const txn1 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: account.addr,
      receiver: account.addr,
      amount: 1000,
      suggestedParams: params,
    });
    
    console.log("txn1 keys:", Object.keys(txn1));
    for (const key of Object.keys(txn1)) {
      let val = txn1[key];
      if (typeof val === "bigint") val = val.toString() + "n";
      else if (val && typeof val === "object" && typeof val.toString === "function") val = val.toString();
      console.log(`- ${key}:`, val);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
