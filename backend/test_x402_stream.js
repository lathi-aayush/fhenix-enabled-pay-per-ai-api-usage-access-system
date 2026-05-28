import algosdk from "algosdk";
import dotenv from "dotenv";
import axios from "axios";
import { createParser } from "eventsource-parser";

dotenv.config();

const MNEMONIC = "lecture rocket indicate pig veteran mixed planet above eye link crime island opera pass frost butter surprise narrow cook stable hunt topic city ability gown";

async function runTest() {
  try {
    const account = algosdk.mnemonicToSecretKey(MNEMONIC);
    const senderAddress = account.addr;
    const algodUrl = process.env.ALGORAND_NODE || "https://testnet-api.algonode.cloud";
    const algodClient = new algosdk.Algodv2("", algodUrl, "");

    const accountInfo = await algodClient.accountInformation(senderAddress).do();
    const balanceAlgos = Number(accountInfo.amount) / 1_000_000;
    if (balanceAlgos < 0.02) {
      throw new Error("Insufficient balance in TestNet account to run this test!");
    }

    const apiBase = "http://localhost:5001";

    const servicesRes = await axios.get(`${apiBase}/api/x402/services`);
    const services = servicesRes.data.services;
    if (!services || services.length === 0) {
      throw new Error("No x402-enabled services found.");
    }
    const service = services[0];
    console.log(`Found Service: "${service.name}" (ID: ${service.id})`);

    let challengeData;
    try {
      await axios.post(`${apiBase}/api/x402/use/${service.id}`, 
        { messages: [{ role: "user", content: "Write a short poem about a stream." }], stream: true },
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      if (err.response && err.response.status === 402) {
        challengeData = err.response.data;
        console.log(`Received 402 Payment Required!`);
      } else {
        throw new Error(`Expected 402 error, got: ${err.message}`);
      }
    }

    const acceptRequirement = challengeData.accepts[0];
    const receiver = acceptRequirement.payTo;
    const amountMicroAlgos = Number(acceptRequirement.maxAmountRequired);

    console.log(`Paying ${amountMicroAlgos / 1_000_000} ALGO to ${receiver}`);

    const params = await algodClient.getTransactionParams().do();
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: senderAddress,
      receiver: receiver,
      amount: BigInt(amountMicroAlgos),
      suggestedParams: params,
      note: new TextEncoder().encode("SentinelAI x402 stream test"),
    });

    const signedTxn = txn.signTxn(account.sk);
    const txId = txn.txID();
    await algodClient.sendRawTransaction(signedTxn).do();

    let confirmedTx = null;
    let attempts = 0;
    while (!confirmedTx && attempts < 10) {
      try {
        confirmedTx = await algodClient.pendingTransactionInformation(txId).do();
        if (confirmedTx["confirmed-round"]) {
          break;
        }
      } catch (e) {}
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    const paymentPayload = {
      paymentGroup: [Buffer.from(signedTxn).toString("base64")],
      paymentIndex: 0,
    };
    const xPaymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");

    console.log("Resending request with payment proof...");
    const res = await axios.post(`${apiBase}/api/x402/use/${service.id}`, 
      { messages: [{ role: "user", content: "Write a short poem about a stream." }], stream: true },
      { 
        headers: { 
          "Content-Type": "application/json",
          "X-Payment": xPaymentHeader
        },
        responseType: "stream"
      }
    );

    console.log("\n--- Stream Output ---");
    let fullText = "";
    const parser = createParser({
      onEvent: (event) => {
        if (event.type === "event") {
          console.log("Raw event:", event.data);
          if (event.data === "[DONE]") {
            console.log("\n[Stream Complete]");
            return;
          }
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.choices?.[0]?.delta?.content) {
              process.stdout.write(parsed.choices[0].delta.content);
              fullText += parsed.choices[0].delta.content;
            }
          } catch (e) {}
        }
      }
    });

    res.data.on('data', chunk => {
      console.log("TEST SCRIPT CHUNK:", chunk.toString());
      parser.feed(chunk.toString());
    });

    await new Promise(resolve => res.data.on('end', resolve));
    console.log("\n---------------------");
    console.log("X-Payment-Response Header:", res.headers["x-payment-response"] ? "Present" : "Missing");

  } catch (err) {
    console.error("\n❌ Test Failed:");
    console.error(err.message || err);
    if (err.response) {
       let body = "";
       err.response.data.on("data", chunk => body += chunk.toString());
       await new Promise(r => err.response.data.on("end", r));
       console.error(body);
    }
  }
}

runTest();
