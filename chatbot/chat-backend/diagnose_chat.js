import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import axios from "axios";
import algosdk from "algosdk";

dotenv.config();

const secret = process.env.JWT_SECRET;
const token = jwt.sign(
  {
    sub: "6a0db771f2881b150a8ed046", // Debjit123 userId
    walletAddress: "KHSDQJZJ6QDNOZSYULRGD6TDVWH3DB7Q2XNSJ5L2X3XT6EJD5IRLZDGNME",
    role: "user",
    displayName: "Debjit123",
    email: "debjitdebnath2978@gmail.com",
  },
  secret,
  { expiresIn: "7d" }
);

const sentinalApi = axios.create({
  baseURL: "http://localhost:5000",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
});

async function payWithBurnerWallet(mnemonic, receiverAddress, amountMicroAlgos, paymentRef) {
  const algodServer = "https://testnet-api.algonode.cloud";
  const algod = new algosdk.Algodv2("", algodServer, "");
  
  const account = algosdk.mnemonicToSecretKey(mnemonic);
  const params = await algod.getTransactionParams().do();
  
  console.log("Account Address (String):", account.addr.toString());
  console.log("Receiver Address:", receiverAddress);
  console.log("Amount (microAlgos):", amountMicroAlgos);
  console.log("Payment Ref:", paymentRef);

  // In algosdk v3, makePaymentTxnWithSuggestedParamsFromObject expects sender and receiver
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: receiverAddress,
    amount: amountMicroAlgos,
    note: new TextEncoder().encode(paymentRef),
    suggestedParams: params,
  });
  
  const signedTxn = txn.signTxn(account.sk);
  const sendResult = await algod.sendRawTransaction(signedTxn).do();
  return sendResult.txid || sendResult.txId;
}

async function run() {
  try {
    console.log("--- 1. Fetching burner mnemonic ---");
    const profileRes = await sentinalApi.get("/api/profile/burner");
    const burnerMnemonic = profileRes.data.mnemonic;
    console.log("Burner mnemonic found:", !!burnerMnemonic);
    if (!burnerMnemonic) return;

    console.log("--- 2. Fetching/generating proxy keys ---");
    const keysRes = await sentinalApi.get("/api/user/proxy-keys");
    let proxyKey;
    const officialKeys = keysRes.data.filter(k => k.service && k.service.isSentinalOfficial);
    if (officialKeys.length === 0) {
      console.log("No official key, fetching services to generate...");
      const servicesRes = await sentinalApi.get("/api/services");
      const officialService = servicesRes.data.find(s => s.isSentinalOfficial);
      if (!officialService) {
        console.error("No official Sentinal service found!");
        return;
      }
      console.log("Generating key for official service:", officialService._id);
      const generateRes = await sentinalApi.post("/api/access/generate", { serviceId: officialService._id });
      proxyKey = generateRes.data.key;
    } else {
      proxyKey = officialKeys[0].key;
    }
    console.log("Proxy API Key:", proxyKey.slice(0, 15) + "...");

    console.log("--- 3. Requesting Quote ---");
    const authHeaders = { Authorization: `Bearer ${proxyKey}` };
    const messagesPayload = [{ role: "user", content: "Hello AI" }];
    const quoteRes = await sentinalApi.post("/api/use", { messages: messagesPayload }, { headers: authHeaders });
    const { paymentRef, expectedMicroAlgos, developerWallet } = quoteRes.data;
    console.log("Quote received:", { paymentRef, expectedMicroAlgos, developerWallet });

    console.log("--- 4. Making burner payment ---");
    let txId;
    try {
      txId = await payWithBurnerWallet(burnerMnemonic, developerWallet, expectedMicroAlgos, paymentRef);
      console.log("Payment successful! TxID:", txId);
    } catch (err) {
      console.error("Payment failed:", err.message);
      return;
    }

    console.log("--- 5. Claiming response ---");
    console.log("Waiting 3s for transaction confirmation...");
    await new Promise(r => setTimeout(r, 3000));
    const finalRes = await sentinalApi.post("/api/use", { txId, paymentRef }, { headers: authHeaders });
    console.log("Claim successful!");
    console.log("AI Response:", finalRes.data.choices?.[0]?.message?.content);
  } catch (err) {
    console.error("API Error:", err.response?.data || err.message);
  }
}

run();
