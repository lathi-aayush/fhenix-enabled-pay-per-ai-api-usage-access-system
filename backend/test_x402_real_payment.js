import algosdk from "algosdk";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

// The funded mnemonic from test_profile_burner.js
const MNEMONIC = "lecture rocket indicate pig veteran mixed planet above eye link crime island opera pass frost butter surprise narrow cook stable hunt topic city ability gown";

async function runTest() {
  try {
    // 1. Recover the sender's account from mnemonic
    const account = algosdk.mnemonicToSecretKey(MNEMONIC);
    const senderAddress = account.addr;
    console.log(`Sender Account Address: ${senderAddress}`);

    // Set up Algod client to fetch params and broadcast transaction
    const algodUrl = process.env.ALGORAND_NODE || "https://testnet-api.algonode.cloud";
    const algodClient = new algosdk.Algodv2("", algodUrl, "");

    // Check account balance first
    const accountInfo = await algodClient.accountInformation(senderAddress).do();
    const balanceAlgos = Number(accountInfo.amount) / 1_000_000;
    console.log(`Sender Balance: ${balanceAlgos} ALGO`);

    if (balanceAlgos < 0.02) {
      throw new Error("Insufficient balance in TestNet account to run this test!");
    }

    const apiBase = `http://localhost:${process.env.PORT || 5001}`;

    // 2. Fetch the list of x402-enabled services
    console.log("\n--- Step 1: Getting x402 services list ---");
    const servicesRes = await axios.get(`${apiBase}/api/x402/services`);
    const services = servicesRes.data.services;
    if (!services || services.length === 0) {
      throw new Error("No x402-enabled services found. Make sure the database is seeded and has services with minimumChargeAlgo > 0.");
    }
    const service = services[0];
    console.log(`Found Service: "${service.name}" (ID: ${service.id})`);
    console.log(`Minimum Charge: ${service.pricing.fixed_charge_algo} ALGO (${service.pricing.fixed_charge_micro_algos} microAlgos)`);

    // 3. Make initial request to trigger HTTP 402 challenge
    console.log("\n--- Step 2: Sending initial request (No payment header) ---");
    let challengeData;
    try {
      await axios.post(`${apiBase}/api/x402/use/${service.id}`, 
        { messages: [{ role: "user", content: "Tell me a very short 1-line joke." }] },
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      if (err.response && err.response.status === 402) {
        challengeData = err.response.data;
        console.log(`Successfully received HTTP 402 Payment Required!`);
        console.log("Challenge Payload:", JSON.stringify(challengeData, null, 2));
      } else {
        throw new Error(`Expected 402 error, got: ${err.message}`);
      }
    }

    if (!challengeData) {
      throw new Error("Did not receive a payment challenge.");
    }

    const acceptRequirement = challengeData.accepts[0];
    const receiver = acceptRequirement.payTo;
    const amountMicroAlgos = Number(acceptRequirement.maxAmountRequired);

    console.log(`\nChallenge demands payment of ${amountMicroAlgos / 1_000_000} ALGO to ${receiver}`);

    // 4. Construct and sign the payment transaction on-chain
    console.log("\n--- Step 3: Creating and signing Algorand transaction ---");
    const params = await algodClient.getTransactionParams().do();
    
    // Create payment transaction
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: senderAddress,
      receiver: receiver,
      amount: BigInt(amountMicroAlgos),
      suggestedParams: params,
      note: new TextEncoder().encode("SentinelAI x402 payment test"),
    });

    // Sign the transaction
    const signedTxn = txn.signTxn(account.sk);
    console.log("Transaction signed successfully.");

    // 5. Broadcast the transaction to the Algorand TestNet
    const txId = txn.txID();
    console.log(`Computed Transaction ID: ${txId}`);
    await algodClient.sendRawTransaction(signedTxn).do();
    console.log(`Transaction submitted.`);
    console.log("Waiting for block confirmation (usually ~3-4 seconds)...");

    // Wait for confirmation on-chain
    let confirmedTx = null;
    let attempts = 0;
    while (!confirmedTx && attempts < 10) {
      try {
        confirmedTx = await algodClient.pendingTransactionInformation(txId).do();
        if (confirmedTx["confirmed-round"]) {
          console.log(`Transaction confirmed in round ${confirmedTx["confirmed-round"]}!`);
          break;
        }
      } catch (e) {
        // ignore errors
      }
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    // 6. Build the base64 X-Payment header
    console.log("\n--- Step 5: Constructing X-Payment header ---");
    const paymentPayload = {
      paymentGroup: [Buffer.from(signedTxn).toString("base64")],
      paymentIndex: 0,
    };
    const xPaymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
    console.log("X-Payment Header generated.");

    // 7. Resend the request with the payment proof header
    console.log("\n--- Step 6: Resending request with payment proof ---");
    const res = await axios.post(`${apiBase}/api/x402/use/${service.id}`, 
      { messages: [{ role: "user", content: "Tell me a very short 1-line joke." }] },
      { 
        headers: { 
          "Content-Type": "application/json",
          "X-Payment": xPaymentHeader
        } 
      }
    );

    console.log("\n--- Success! HTTP 200 Received ---");
    console.log("Response headers:", JSON.stringify(res.headers, ["x-payment-response", "content-type"], 2));
    console.log("Response body:");
    console.log(JSON.stringify(res.data, null, 2));

  } catch (err) {
    console.error("\n❌ Test Failed:");
    if (err.response) {
      console.error(`Status: ${err.response.status}`);
      console.error("Data:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err);
    }
  }
}

runTest();
